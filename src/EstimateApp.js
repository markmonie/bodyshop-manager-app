import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import axios from 'axios';

// --- TRIPLE MMM CONFIG ---
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
const inputStyle = { width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1em' };
const headerStyle = { borderBottom: '2px solid #cc0000', paddingBottom: '5px', marginBottom: '10px', color: '#cc0000', fontSize: '0.9em' };
const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '2px 0' };
const primaryBtn = { padding: '12px 24px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' };
const successBtn = { padding: '12px 24px', background: '#15803d', color: 'white', border: '2px solid #22c55e', borderRadius: '6px', fontWeight: 'bold', cursor: 'default', boxShadow: '0 0 10px #22c55e' };
const secondaryBtn = { padding: '12px 24px', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };

const EstimateApp = ({ userId }) => {
    // Modes
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
        dvlaKey: ''
    });

    // Inputs
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [claimNum, setClaimNum] = useState('');
    const [networkCode, setNetworkCode] = useState('');
    const [insuranceCo, setInsuranceCo] = useState('');
    const [insuranceAddr, setInsuranceAddr] = useState('');
    
    // Vehicle & Booking
    const [reg, setReg] = useState('');
    const [mileage, setMileage] = useState('');
    const [makeModel, setMakeModel] = useState('');
    const [vin, setVin] = useState(''); 
    const [paintCode, setPaintCode] = useState('');
    const [bookingDate, setBookingDate] = useState(''); 
    const [bookingTime, setBookingTime] = useState('09:00'); 
    const [foundHistory, setFoundHistory] = useState(false);

    // Items
    const [itemDesc, setItemDesc] = useState('');
    const [itemCostPrice, setItemCostPrice] = useState(''); 
    const [items, setItems] = useState([]);
    
    // Photos & Internal
    const [photos, setPhotos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [paintAllocated, setPaintAllocated] = useState(''); 
    const [expDesc, setExpDesc] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expCategory, setExpCategory] = useState('Stock');

    // Financials
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

    // --- NEW: DEAL FILE STATE ---
    const [currentJobId, setCurrentJobId] = useState(null); 
    const [methodsRequired, setMethodsRequired] = useState(false);

    // --- NEW: CALCULATE ACTIVE JOB ---
    const activeJob = useMemo(() => savedEstimates.find(j => j.id === currentJobId), [savedEstimates, currentJobId]);

    // LOAD SETTINGS
    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => {
            if(snap.exists()) {
                const s = snap.data();
                setSettings(s);
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

    // AUTO-LOAD & SAVE DRAFT
    useEffect(() => {
        const savedData = localStorage.getItem('triple_mmm_draft');
        if (savedData) {
            const draft = JSON.parse(savedData);
            setName(draft.name || ''); setReg(draft.reg || ''); setItems(draft.items || []);
            setLaborRate(draft.laborRate || settings.laborRate); setClaimNum(draft.claimNum || '');
            setNetworkCode(draft.networkCode || ''); setPhotos(draft.photos || []);
            setPaintAllocated(draft.paintAllocated || '');
            setBookingDate(draft.bookingDate || ''); setBookingTime(draft.bookingTime || '09:00');
            setVin(draft.vin || ''); setPaintCode(draft.paintCode || '');
            setExcess(draft.excess || ''); setInsuranceCo(draft.insuranceCo || ''); setInsuranceAddr(draft.insuranceAddr || '');
        }
    }, [settings]);

    useEffect(() => {
        if(mode === 'SETTINGS' || mode === 'DASHBOARD' || mode === 'DEAL_FILE') return;
        const draft = { name, reg, items, laborRate, claimNum, networkCode, photos, paintAllocated, bookingDate, bookingTime, vin, paintCode, excess, insuranceCo, insuranceAddr, mode };
        localStorage.setItem('triple_mmm_draft', JSON.stringify(draft));
    }, [name, reg, items, laborRate, claimNum, networkCode, photos, paintAllocated, bookingDate, bookingTime, vin, paintCode, excess, insuranceCo, insuranceAddr, mode]);

    // --- FUNCTIONS ---
    
    // NEW: JOB LOADER
    const loadJobIntoState = (est) => {
        setCurrentJobId(est.id); 
        setName(est.customer);
        setReg(est.reg);
        setInvoiceNum(est.invoiceNumber || '');
        setMethodsRequired(est.dealFile?.methodsRequired || false); 
        setMode('DEAL_FILE'); 
        window.scrollTo(0, 0);
    };

    // NEW: UPLOAD LOGIC
    const uploadDoc = async (docType, file) => {
        if (!currentJobId) return alert("Please SAVE the job first before uploading documents.");
        if (!file) return;

        const storageRef = ref(storage, `deal_docs/${currentJobId}/${docType}_${file.name}`);
        
        try {
            setSaveStatus('SAVING');
            const snap = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snap.ref);
            
            const fileData = { name: file.name, url: url, date: new Date().toLocaleDateString() };
            
            // Update Firestore with the new file link using dot notation
            await updateDoc(doc(db, 'estimates', currentJobId), {
                [`dealFile.${docType}`]: fileData
            });
            
            setSaveStatus('IDLE');
            alert("Document Uploaded!");
        } catch (e) {
            console.error(e);
            alert("Upload failed: " + e.message);
            setSaveStatus('IDLE');
        }
    };

    const toggleMethods = async () => {
        if (!currentJobId) return alert("Save job first.");
        const newVal = !methodsRequired;
        setMethodsRequired(newVal);
        await updateDoc(doc(db, 'estimates', currentJobId), { 'dealFile.methodsRequired': newVal });
    };

    const addToGoogleCalendar = () => {
        if(!bookingDate) return alert("Please select a Booking Date first.");
        const start = bookingDate.replace(/-/g, '') + 'T' + bookingTime.replace(/:/g, '') + '00';
        const end = bookingDate.replace(/-/g, '') + 'T' + (parseInt(bookingTime.split(':')[0]) + 1).toString().padStart(2, '0') + bookingTime.split(':')[1] + '00';
        
        const title = encodeURIComponent(`Repair: ${name} (${reg})`);
        const details = encodeURIComponent(`Vehicle: ${makeModel}\nPhone: ${phone}\n\nWork Required:\n${items.map(i => '- ' + i.desc).join('\n')}`);
        const loc = encodeURIComponent(settings.address);
        
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${loc}`;
        window.open(url, '_blank');
    };

    const handlePrint = () => {
        setTimeout(() => {
            window.print();
        }, 500);
    };

    const checkHistory = async (regInput) => {
        if(regInput.length < 3) return;
        const q = query(collection(db, 'estimates'), where("reg", "==", regInput), orderBy('createdAt', 'desc'));
        try {
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const prev = querySnapshot.docs[0].data();
                setMakeModel(prev.makeModel || ''); 
                setName(prev.customer || '');
                setPhone(prev.phone || '');
                setEmail(prev.email || '');
                setAddress(prev.address || '');
                setVin(prev.vin || '');
                setPaintCode(prev.paintCode || '');
                if(prev.insuranceCo) setInsuranceCo(prev.insuranceCo);
                setFoundHistory(true);
            }
        } catch(e) { }
    };

    const handleRegChange = (e) => {
        const val = e.target.value.toUpperCase();
        setReg(val);
        setFoundHistory(false);
    };

    const lookupReg = async () => {
        if (!reg || reg.length < 3) return alert("Enter Registration");
        if (settings.dvlaKey) {
            try {
                const res = await axios.post(
                    'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles',
                    { registrationNumber: reg },
                    { headers: { 'x-api-key': settings.dvlaKey } }
                );
                if (res.data) {
                    setMakeModel(`${res.data.make} ${res.data.colour}`);
                    alert("Vehicle Found!");
                }
            } catch (e) { alert("DVLA Error: " + e.message); }
        } else {
            alert("Waiting for DVLA Key... (Simulated: Vehicle Found!)");
            setMakeModel("FORD TRANSIT (Simulated)");
        }
    };

    const addItem = () => {
        if (!itemDesc) return;
        const cost = parseFloat(itemCostPrice) || 0;
        const markupPercent = parseFloat(settings.markup) || 0;
        const price = cost * (1 + (markupPercent / 100)); 
        setItems([...items, { desc: itemDesc, costPrice: cost, price: price }]);
        setItemDesc(''); setItemCostPrice('');
    };

    const removeItem = (indexToRemove) => {
        setItems(items.filter((_, index) => index !== indexToRemove));
    };

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

    // --- ACTIONS ---
    const saveSettings = async () => {
        await setDoc(doc(db, 'settings', 'global'), settings);
        alert("Settings Saved!");
        setMode('ESTIMATE');
        setLaborRate(settings.laborRate);
        setVatRate(settings.vatRate);
    };

    const addGeneralExpense = async () => {
        if(!expDesc || !expAmount) return;
        await addDoc(collection(db, 'expenses'), { desc: expDesc, amount: parseFloat(expAmount), category: expCategory, date: serverTimestamp() });
        setExpDesc(''); setExpAmount('');
    };
    
    const deleteJob = async (id) => {
        if(window.confirm("WARNING: Delete this job permanently?")) {
            try { await deleteDoc(doc(db, 'estimates', id)); } catch (e) { alert("Error deleting: " + e.message); }
        }
    };

    const deleteExpense = async (id) => { if(window.confirm("Delete?")) await deleteDoc(doc(db, 'expenses', id)); };

    const saveToCloud = async (targetType) => {
        if (!name || !reg) return alert("Enter Customer Name & Reg");
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

            // UPDATED SAVE LOGIC: CAPTURE ID
            const docRef = await addDoc(collection(db, 'estimates'), {
                type: displayType, status: 'UNPAID', invoiceNumber: finalInvNum,
                customer: name, address, phone, email, claimNum, networkCode, insuranceCo, insuranceAddr,
                reg, mileage, makeModel, vin, paintCode,
                items, laborHours, laborRate, vatRate, excess, photos,
                bookingDate, bookingTime, 
                totals: calculateJobFinancials(), createdAt: serverTimestamp(), createdBy: userId,
                // Initialize dealFile object so uploads work
                dealFile: { methodsRequired: false }
            });
            
            // Set current ID so we can immediately upload files
            setCurrentJobId(docRef.id);

            setSaveStatus('SUCCESS'); setTimeout(() => setSaveStatus('IDLE'), 3000); 
        } catch (error) { alert("Error saving: " + error.message); setSaveStatus('IDLE'); }
    };

    const clearForm = () => {
        if(window.confirm("Start fresh?")) {
            setMode('ESTIMATE'); setInvoiceNum(''); setInvoiceDate(''); setName(''); setAddress(''); setPhone(''); setEmail('');
            setReg(''); setMileage(''); setMakeModel(''); setClaimNum(''); setNetworkCode(''); setVin(''); setPaintCode('');
            setItems([]); setLaborHours(''); setExcess(''); setPhotos([]); setPaintAllocated(''); setInsuranceCo(''); setInsuranceAddr('');
            setBookingDate(''); setBookingTime('09:00'); setFoundHistory(false);
            setSaveStatus('IDLE'); localStorage.removeItem('triple_mmm_draft'); 
            
            // RESET NEW STATE
            setCurrentJobId(null);
            setMethodsRequired(false);

            if(canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); }
        }
    };

    const handlePhotoUpload = async (e) => {
        if (!e.target.files[0]) return;
        setUploading(true);
        const file = e.target.files[0];
        const storageRef = ref(storage, `damage_photos/${Date.now()}_${file.name}`);
        try { await uploadBytes(storageRef, file); const url = await getDownloadURL(storageRef); setPhotos([...photos, url]); } 
        catch (error) { alert("Upload failed!"); }
        setUploading(false);
    };
    const removePhoto = (index) => setPhotos(photos.filter((_, i) => i !== index));

    const startDrawing = ({nativeEvent}) => { const {offsetX, offsetY} = getCoordinates(nativeEvent); const ctx = canvasRef.current.getContext('2d'); ctx.lineWidth=3; ctx.lineCap='round'; ctx.strokeStyle='#000'; ctx.beginPath(); ctx.moveTo(offsetX, offsetY); setIsDrawing(true); };
    const draw = ({nativeEvent}) => { if(!isDrawing) return; const {offsetX, offsetY} = getCoordinates(nativeEvent); canvasRef.current.getContext('2d').lineTo(offsetX, offsetY); canvasRef.current.getContext('2d').stroke(); };
    const stopDrawing = () => { const ctx = canvasRef.current.getContext('2d'); ctx.closePath(); setIsDrawing(false); };
    const getCoordinates = (event) => { if (event.touches && event.touches[0]) { const rect = canvasRef.current.getBoundingClientRect(); return { offsetX: event.touches[0].clientX - rect.left, offsetY: event.touches[0].clientY - rect.top }; } return { offsetX: event.offsetX, offsetY: event.offsetY }; };
    const clearSignature = () => { if(canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); } };
    useEffect(() => { clearSignature(); }, [mode]);

    const downloadAccountingCSV = () => {
        const invoices = savedEstimates.filter(est => est.type && est.type.includes('INVOICE'));
        let csv = "data:text/csv;charset=utf-8,Date,Type,Invoice,Customer,Reg,Total,Status\n";
        invoices.forEach(inv => {
            const d = inv.createdAt ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
            const total = inv.type.includes('EXCESS') ? inv.excess : inv.totals.finalDue; 
            csv += `${d},${inv.type},${inv.invoiceNumber},${inv.customer},${inv.reg},${parseFloat(total).toFixed(2)},${inv.status}\n`;
        });
        const link = document.createElement("a"); link.href = encodeURI(csv); link.download = "TripleMMM_Ledger.csv"; link.click();
    };

    const togglePaid = async (id, currentStatus) => {
        const newStatus = currentStatus === 'PAID' ? 'UNPAID' : 'PAID';
        await updateDoc(doc(db, 'estimates', id), { status: newStatus });
    };

    const filteredEstimates = savedEstimates.filter(est => {
        const search = searchTerm.toLowerCase();
        return ( (est.customer && est.customer.toLowerCase().includes(search)) || (est.reg && est.reg.toLowerCase().includes(search)) || (est.invoiceNumber && est.invoiceNumber.toLowerCase().includes(search)) );
    });

    // Helper for email link generation (Prevents Syntax Error)
    const emailSubject = `Repair Docs: ${reg} (Claim: ${claimNum})`;
    const emailBody = `Attached documents for vehicle ${reg}.%0D%0A%0D%0A1. Authority: Attached%0D%0A2. Invoice: ${invoiceNum}%0D%0A3. Satisfaction Note: ${activeJob?.dealFile?.satisfaction ? 'Attached' : 'Pending'}`;
    const emailLink = `mailto:?subject=${emailSubject}&body=${emailBody}`;

    // --- VIEWS ---
    if(mode === 'SETTINGS') return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
            <button onClick={() => setMode('ESTIMATE')} className="no-print" style={{marginBottom:'20px', padding:'10px', background:'#eee', border:'none', borderRadius:'4px', cursor:'pointer'}}>← Back</button>
            <h2 style={{borderBottom:'2px solid #333', paddingBottom:'10px'}}>⚙️ Settings</h2>
            <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                <label>Labor Rate (£/hr): <input value={settings.laborRate} onChange={e => setSettings({...settings, laborRate: e.target.value})} style={inputStyle} /></label>
                <label>Parts Markup (%): <input value={settings.markup} onChange={e => setSettings({...settings, markup: e.target.value})} style={inputStyle} /></label>
                <label>DVLA API Key: <input value={settings.dvlaKey} onChange={e => setSettings({...settings, dvlaKey: e.target.value})} style={inputStyle} placeholder="Paste key here later" /></label>
                <label>Address: <textarea value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} style={{...inputStyle, height:'60px'}} /></label>
                <button onClick={saveSettings} style={primaryBtn}>SAVE SETTINGS</button>
            </div>
        </div>
    );

    if(mode === 'DASHBOARD') {
        const totalSales = savedEstimates.filter(e => e.type && e.type.includes('INVOICE')).reduce((acc, curr) => acc + (curr.type.includes('EXCESS') ? parseFloat(curr.excess) : curr.totals?.finalDue || 0), 0);
        const totalJobCosts = savedEstimates.filter(e => e.type && e.type.includes('INVOICE')).reduce((acc, curr) => acc + (curr.totals?.totalJobCost || 0), 0);
        const totalOverheads = generalExpenses.reduce((acc, curr) => acc + curr.amount, 0);
        const netProfit = totalSales - totalJobCosts - totalOverheads;
        return (
            <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
                <button onClick={() => setMode('ESTIMATE')} style={{marginBottom:'20px', padding:'10px'}}>← Back</button>
                <h2>📊 Financial Dashboard</h2>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'30px'}}>
                    <div style={{padding:'20px', background:'#f0fdf4', borderRadius:'8px'}}><h3>Total Sales</h3><div style={{fontSize:'2em', fontWeight:'bold', color:'#166534'}}>£{totalSales.toFixed(2)}</div></div>
                    <div style={{padding:'20px', background:'#ecfccb', borderRadius:'8px'}}><h3>Net Profit</h3><div style={{fontSize:'2em', fontWeight:'bold', color: netProfit > 0 ? '#166534' : '#991b1b'}}>£{netProfit.toFixed(2)}</div></div>
                </div>
                <h3>Log General Expense</h3>
                <div style={{display:'flex', gap:'10px', marginBottom:'30px'}}>
                    <input placeholder="Desc" value={expDesc} onChange={e => setExpDesc(e.target.value)} style={{flex:1, padding:'10px'}} />
                    <input type="number" placeholder="£" value={expAmount} onChange={e => setExpAmount(e.target.value)} style={{width:'80px', padding:'10px'}} />
                    <button onClick={addGeneralExpense} style={primaryBtn}>Add</button>
                </div>
                <h3>Expense Log</h3>
                {generalExpenses.map(ex => (<div key={ex.id} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', padding:'10px'}}><span>{ex.desc}</span><div style={{display:'flex', gap:'10px'}}><strong>£{ex.amount.toFixed(2)}</strong><button onClick={() => deleteExpense(ex.id)} style={{color:'red', border:'none', background:'none', cursor:'pointer'}}>x</button></div></div>))}
            </div>
        );
    }

    return (
        <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Arial, sans-serif', background: 'white' }}>
            {mode !== 'ESTIMATE' && <button onClick={() => setMode('ESTIMATE')} className="no-print" style={{marginBottom:'20px', padding:'10px', background:'#eee', border:'none', borderRadius:'4px', cursor:'pointer'}}>← BACK TO ESTIMATE</button>}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '4px solid #cc0000', paddingBottom: '20px', marginBottom: '30px' }}>
                <div>{!logoError ? <img src={process.env.PUBLIC_URL + "/1768838821897.png"} alt="TRIPLE MMM" style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }} onError={() => setLogoError(true)} /> : <div style={{ fontSize: '3em', fontWeight: '900', letterSpacing: '-2px', lineHeight:'0.9' }}><span style={{color: 'black'}}>TRIPLE</span><br/><span style={{color: '#cc0000'}}>MMM</span></div>}</div>
                <div style={{ textAlign: 'right', fontSize: '0.9em', color: '#333' }}><div style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '5px' }}>{settings.address}</div><div>Tel: <strong>{settings.phone}</strong></div><div>Email: {settings.email}</div></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '2em', color: '#333' }}>{mode === 'SATISFACTION' ? 'SATISFACTION NOTE' : (mode === 'JOBCARD' ? 'WORKSHOP JOB CARD' : (mode === 'DEAL_FILE' ? 'DIGITAL DEAL FILE' : (invoiceType === 'EXCESS' ? 'INVOICE (EXCESS)' : mode)))}</h2>
                {mode !== 'ESTIMATE' && mode !== 'JOBCARD' && mode !== 'DEAL_FILE' && <div style={{ textAlign: 'right' }}><div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{invoiceNum}</div><div>Date: {invoiceDate || new Date().toLocaleDateString()}</div></div>}
            </div>

            {/* --- MAIN FORM --- */}
            {mode !== 'DEAL_FILE' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px', border: '1px solid #eee', padding: '20px', borderRadius: '8px' }}>
                <div>
                    <h4 style={headerStyle}>CLIENT DETAILS</h4>
                    <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
                    <textarea placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} style={{...inputStyle, height: '60px', fontFamily: 'inherit'}} />
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px'}}>
                        <input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
                        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', marginTop:'5px'}}>
                        <input placeholder="Claim No." value={claimNum} onChange={e => setClaimNum(e.target.value)} style={{...inputStyle, border:'1px solid #2563eb'}} />
                        <input placeholder="Network Code" value={networkCode} onChange={e => setNetworkCode(e.target.value)} style={{...inputStyle, border:'1px solid #2563eb'}} />
                    </div>
                    {/* INSURANCE CO BOX FOR EXCESS JOBS */}
                    {excess > 0 && (
                        <div style={{marginTop:'10px', background:'#fffbeb', padding:'10px', borderRadius:'4px', border:'1px solid #f59e0b'}}>
                            <h5 style={{margin:'0 0 5px 0', color:'#b45309'}}>Insurance Company</h5>
                            <input placeholder="Insurer Name" value={insuranceCo} onChange={e => setInsuranceCo(e.target.value)} style={{...inputStyle, marginBottom:'5px'}} />
                            <textarea placeholder="Address" value={insuranceAddr} onChange={e => setInsuranceAddr(e.target.value)} style={{...inputStyle, height:'50px', marginBottom:0}} />
                        </div>
                    )}
                </div>
                <div>
                    <h4 style={headerStyle}>VEHICLE DETAILS</h4>
                    <div style={{display:'flex', gap:'10px'}}>
                        <input placeholder="Reg" value={reg} onChange={handleRegChange} onBlur={() => checkHistory(reg)} style={{...inputStyle, fontWeight:'bold', textTransform:'uppercase', background:'#f0f9ff'}} />
                        <button onClick={lookupReg} className="no-print" style={{background:'#4b5563', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>🔎</button>
                        <input placeholder="Mileage" value={mileage} onChange={e => setMileage(e.target.value)} style={inputStyle} />
                    </div>
                    {foundHistory && <div style={{color:'green', fontSize:'0.8em', marginTop:'-8px', marginBottom:'5px'}}>✓ Found previous customer!</div>}
                    <input placeholder="Make / Model" value={makeModel} onChange={e => setMakeModel(e.target.value)} style={inputStyle} />
                    
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', marginTop:'5px'}}>
                        <input placeholder="Chassis / VIN" value={vin} onChange={e => setVin(e.target.value)} style={inputStyle} />
                        <input placeholder="Paint Code" value={paintCode} onChange={e => setPaintCode(e.target.value)} style={inputStyle} />
                    </div>

                    <div style={{marginTop:'15px', borderTop:'1px dashed #ccc', paddingTop:'10px'}}>
                        <h4 style={{fontSize:'0.9em', color:'#666', margin:'0 0 5px 0'}}>BOOKING</h4>
                        <div style={{display:'flex', gap:'5px', alignItems:'center'}}>
                            <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} style={{...inputStyle, marginBottom:0}} />
                            <input type="time" value={bookingTime} onChange={e => setBookingTime(e.target.value)} style={{...inputStyle, marginBottom:0, width:'100px'}} />
                            <button onClick={addToGoogleCalendar} className="no-print" style={{background:'#2563eb', color:'white', border:'none', padding:'8px', borderRadius:'4px', cursor:'pointer'}}>📅 Add</button>
                        </div>
                    </div>
                    <div className="no-print" style={{marginTop:'10px', background:'#f0fdf4', padding:'10px', borderRadius:'4px', border:'1px dashed #16a34a'}}>
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                    </div>
                </div>
            </div>
            )}

            {/* PHOTOS */}
            {photos.length > 0 && mode !== 'DEAL_FILE' && <div style={{marginBottom:'20px', display:'flex', gap:'10px', flexWrap:'wrap'}}>{photos.map((url, i) => (<div key={i} style={{position:'relative', width:'100px', height:'100px'}}><img src={url} alt="Damage" style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:'4px', border:'1px solid #ddd'}} /><button className="no-print" onClick={() => removePhoto(i)} style={{position:'absolute', top:-5, right:-5, background:'red', color:'white', borderRadius:'50%', width:'20px', height:'20px', cursor:'pointer'}}>×</button></div>))}</div>}

            {mode !== 'SATISFACTION' && mode !== 'DEAL_FILE' && (
                <>
                    {invoiceType !== 'EXCESS' && (
                        <>
                            <div className="no-print" style={{ background: '#f8fafc', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input placeholder="Desc" value={itemDesc} onChange={e => setItemDesc(e.target.value)} style={{ flexGrow: 1, padding: '10px' }} />
                                    <input type="number" placeholder="Cost £" value={itemCostPrice} onChange={e => setItemCostPrice(e.target.value)} style={{ width: '80px', padding: '10px' }} />
                                    <button onClick={addItem} style={{ background: '#333', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>Add (+{settings.markup}%)</button>
                                </div>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                                <thead><tr style={{textAlign:'left', borderBottom:'2px solid #333', color: '#333'}}><th style={{padding:'10px'}}>DESCRIPTION</th>{mode !== 'JOBCARD' && <th style={{textAlign:'right', padding:'10px'}}>PRICE</th>}</tr></thead>
                                <tbody>{items.map((item, i) => (<tr key={i} style={{ borderBottom: '1px solid #eee' }}><td style={{padding:'12px 10px'}}>{item.desc}</td>{mode !== 'JOBCARD' && <td style={{textAlign:'right', padding:'12px 10px'}}>£{item.price.toFixed(2)}</td>}<td className="no-print" style={{textAlign:'center'}}><button onClick={() => removeItem(i)} style={{background:'#ef4444', color:'white', border:'none', borderRadius:'50%', width:'24px', height:'24px', cursor:'pointer', fontWeight:'bold'}}>×</button></td></tr>))}</tbody>
                            </table>
                        </>
                    )}

                    {invoiceType === 'EXCESS' && (
                         <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                            <thead><tr style={{textAlign:'left', borderBottom:'2px solid #333', color: '#333'}}><th style={{padding:'10px'}}>DESCRIPTION</th><th style={{textAlign:'right', padding:'10px'}}>PRICE</th></tr></thead>
                            <tbody><tr style={{ borderBottom: '1px solid #eee' }}><td style={{padding:'12px 10px'}}>Insurance Excess Contribution for Claim: {claimNum}</td><td style={{textAlign:'right', padding:'12px 10px'}}>£{excess}</td></tr></tbody>
                        </table>
                    )}

                    {mode !== 'JOBCARD' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '300px', textAlign: 'right' }}>
                                {invoiceType !== 'EXCESS' && (
                                    <>
                                    <div className="no-print" style={{marginBottom:'10px'}}>Labor: <input type="number" value={laborHours} onChange={e => setLaborHours(e.target.value)} style={{width:'50px'}} /> hrs @ £<input type="number" value={laborRate} onChange={e => setLaborRate(e.target.value)} style={{width:'50px'}} /></div>
                                    <div style={rowStyle}><span>Labor Total:</span> <span>£{totals.labor.toFixed(2)}</span></div>
                                    <div style={rowStyle}><span>Parts Total:</span> <span>£{totals.partsPrice.toFixed(2)}</span></div>
                                    <div style={{...rowStyle, fontSize:'1.2em', fontWeight:'bold', borderTop:'2px solid #333', marginTop:'5px'}}><span>GRAND TOTAL:</span> <span>£{totals.invoiceTotal.toFixed(2)}</span></div>
                                    <div style={{...rowStyle, color:'#dc2626'}}><span>Less Excess:</span><span className="no-print"><input type="number" value={excess} onChange={e => setExcess(e.target.value)} style={{width:'60px'}} /></span><span>-£{totals.excessAmount.toFixed(2)}</span></div>
                                    </>
                                )}
                                <div style={{...rowStyle, fontSize:'1.4em', fontWeight:'bold', color:'#333', borderTop:'2px solid #333', marginTop:'5px', paddingTop:'10px'}}>
                                    <span>BALANCE DUE:</span> 
                                    <span>£{invoiceType === 'EXCESS' ? parseFloat(excess).toFixed(2) : totals.finalDue.toFixed(2)}</span>
                                </div>
                                
                                <div className="no-print" style={{marginTop:'20px', padding:'10px', background:'#fef2f2', borderRadius:'4px', border:'1px dashed #f87171'}}>
                                    <h4 style={{margin:'0 0 5px 0', color:'#991b1b'}}>Internal Job Costs</h4>
                                    <div style={rowStyle}><span>Allocated Materials:</span> <input type="number" value={paintAllocated} onChange={e => setPaintAllocated(e.target.value)} style={{width:'60px'}} /></div>
                                    <div style={rowStyle}><span>Parts Cost:</span> <span>£{totals.partsCost.toFixed(2)}</span></div>
                                    <div style={{...rowStyle, fontWeight:'bold', color: totals.jobProfit > 0 ? 'green' : 'red'}}><span>Job Profit:</span> <span>£{totals.jobProfit.toFixed(2)}</span></div>
                                </div>
                            </div>
                        </div>
                    )}
                    {(mode === 'INVOICE' || mode === 'JOBCARD') && (
                        <div style={{ marginTop: '50px', padding: '20px', background: '#f9f9f9', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', border: '1px solid #ddd' }}>
                            {mode === 'INVOICE' && (
                                <div>
                                    <h4 style={{margin:'0 0 10px 0'}}>PAYMENT DETAILS</h4>
                                    <div style={{fontSize:'0.9em', lineHeight:'1.6'}}>
                                        <strong>Bill To:</strong> {invoiceType === 'EXCESS' ? name : (insuranceCo || name)}<br/><br/>
                                        Account Name: <strong>{settings.companyName} BODY REPAIRS</strong><br/>Account No: <strong>06163462</strong><br/>Sort Code: <strong>80-22-60</strong><br/>Bank: <strong>BANK OF SCOTLAND</strong>
                                    </div>
                                    <div style={{marginTop:'15px', fontSize:'0.7em', color:'#666', borderTop:'1px solid #ccc', paddingTop:'5px'}}>
                                        Payment terms: <strong>{invoiceType === 'EXCESS' ? '7 Days' : '30 Days'}</strong> from date of invoice.<br/>Title of goods remains with Triple MMM until paid in full.
                                    </div>
                                </div>
                            )}
                            <div style={{ textAlign: 'center', width: '350px', marginTop: '20px' }}>
                                <div className="no-print" style={{border: '1px dashed #ccc', height: '100px', backgroundColor: '#fff', position: 'relative', marginBottom:'5px'}}><canvas ref={canvasRef} width={350} height={100} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={{width: '100%', height: '100%', touchAction: 'none'}} /><button onClick={clearSignature} style={{position: 'absolute', top: 5, right: 5, fontSize: '0.7em', padding: '2px 5px'}}>Clear</button></div>
                                <div style={{ borderBottom: '1px solid #333', height: '40px', marginBottom: '5px' }}></div>
                                <div style={{fontSize:'0.8em', color:'#666'}}>{mode === 'JOBCARD' ? 'TECHNICIAN SIGNATURE' : 'AUTHORISED SIGNATURE'}</div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {mode === 'SATISFACTION' && (
                <div style={{ marginTop: '20px', padding: '30px', border: '2px solid #333' }}>
                    <p style={{ lineHeight: '1.8', fontSize: '1.1em' }}>I/We being the owner/policyholder of vehicle registration <strong>{reg}</strong> hereby confirm that the repairs attended to by <strong>{settings.companyName} BODY REPAIRS</strong> have been completed to my/our entire satisfaction.</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '80px', gap: '20px' }}>
                        <div style={{ width: '45%' }}><div className="no-print" style={{border: '1px dashed #ccc', height: '100px', backgroundColor: '#fff', position: 'relative', marginBottom:'5px'}}><canvas ref={canvasRef} width={350} height={100} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={{width: '100%', height: '100%', touchAction: 'none'}} /><button onClick={clearSignature} style={{position: 'absolute', top: 5, right: 5, fontSize: '0.7em', padding: '2px 5px'}}>Clear</button></div><div style={{ borderBottom: '1px solid #333', marginBottom: '10px' }}></div><strong>Customer Signature</strong></div>
                        <div style={{ width: '45%' }}><div style={{ borderBottom: '1px solid #333', height: '100px', marginBottom: '10px', display:'flex', alignItems:'flex-end' }}><span>{new Date().toLocaleDateString()}</span></div><strong>Date</strong></div>
                    </div>
                </div>
            )}

            {/* --- NEW: DEAL FILE VIEW --- */}
            {mode === 'DEAL_FILE' && (
                <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', background: '#f8fafc' }}>
                    <h2 style={{borderBottom:'2px solid #333', paddingBottom:'10px'}}>📂 Digital Deal File: {reg}</h2>
                    
                    {!currentJobId && <div style={{padding:'10px', background:'#fee2e2', color:'#991b1b'}}>⚠️ Job not saved. Please click "Save Estimate" first.</div>}

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginTop:'20px'}}>
                        
                        {/* COLUMN 1: UPLOADS */}
                        <div style={{background:'white', padding:'15px', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
                            <h4 style={{color:'#333', margin:'0 0 15px 0'}}>1. External Documents</h4>

                            {/* AUTHORITY */}
                            <div style={{marginBottom:'20px', paddingBottom:'15px', borderBottom:'1px dashed #eee'}}>
                                <div style={{display:'flex', justifyContent:'space-between'}}>
                                    <strong>📋 Insurer Authority</strong>
                                    <span>{activeJob?.dealFile?.auth ? '✅ Uploaded' : '❌ Pending'}</span>
                                </div>
                                <input type="file" style={{marginTop:'5px', fontSize:'0.9em'}} onChange={(e) => uploadDoc('auth', e.target.files[0])} />
                                {activeJob?.dealFile?.auth && <a href={activeJob.dealFile.auth.url} target="_blank" rel="noreferrer" style={{fontSize:'0.8em', display:'block', color:'#2563eb'}}>View Saved Auth</a>}
                            </div>

                            {/* METHODS */}
                            <div>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                    <strong>🔧 Repair Methods</strong>
                                    <label style={{fontSize:'0.8em', display:'flex', alignItems:'center', cursor:'pointer', background:'#eee', padding:'2px 8px', borderRadius:'10px'}}>
                                        <input type="checkbox" checked={methodsRequired} onChange={toggleMethods} style={{marginRight:'5px'}} />
                                        {methodsRequired ? 'REQUIRED' : 'NOT REQ'}
                                    </label>
                                </div>
                                {methodsRequired ? (
                                    <div style={{marginTop:'10px'}}>
                                        <input type="file" style={{marginTop:'5px', fontSize:'0.9em'}} onChange={(e) => uploadDoc('methods', e.target.files[0])} />
                                        <div style={{fontSize:'0.8em', color: activeJob?.dealFile?.methods ? 'green' : '#dc2626', marginTop:'5px'}}>
                                            {activeJob?.dealFile?.methods ? '✅ Methods on file' : '* Structural repair. PDF Required.'}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{marginTop:'10px', fontSize:'0.8em', color:'#16a34a', fontStyle:'italic'}}>✅ Cosmetic Only.</div>
                                )}
                            </div>
                        </div>

                        {/* COLUMN 2: SYSTEM CHECKS */}
                        <div style={{background:'white', padding:'15px', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
                            <h4 style={{color:'#333', margin:'0 0 15px 0'}}>2. System Generated</h4>
                            <div style={rowStyle}><span>📸 Images</span><strong>{photos.length > 0 ? `✅ ${photos.length} Photos` : '❌ Need Photos'}</strong></div>
                            <div style={rowStyle}><span>💰 Invoice</span><strong>{invoiceNum ? `✅ ${invoiceNum}` : '❌ Pending'}</strong></div>
                            
                            {/* SATISFACTION NOTE UPLOAD */}
                            <div style={{marginTop:'10px', paddingTop:'10px', borderTop:'1px dashed #eee'}}>
                                <div style={{display:'flex', justifyContent:'space-between'}}>
                                    <span>✍️ Satisfaction Note</span>
                                    <span>{activeJob?.dealFile?.satisfaction ? '✅ Ready' : '❌ Pending'}</span>
                                </div>
                                
                                <input type="file" style={{marginTop:'5px', fontSize:'0.9em'}} onChange={(e) => uploadDoc('satisfaction', e.target.files[0])} />
                                
                                {activeJob?.dealFile?.satisfaction && (
                                    <a href={activeJob.dealFile.satisfaction.url} target="_blank" rel="noreferrer" style={{fontSize:'0.8em', display:'block', color:'#2563eb', marginTop:'2px'}}>
                                        View Signed Note
                                    </a>
                                )}
                            </div>
                            
                            <div style={{marginTop:'20px', paddingTop:'15px', borderTop:'2px solid #eee'}}>
                                 <div style={{fontSize:'0.8em', color:'#666', marginBottom:'5px'}}>SEND PACK TO:</div>
                                 <div style={{fontWeight:'bold', fontSize:'1.1em'}}>{insuranceCo || 'Unknown Insurer'}</div>
                                 
                                 {/* LOGIC: Show button if Auth exists AND (Methods are either Not Required OR Uploaded) */}
                                 {(activeJob?.dealFile?.auth && (!methodsRequired || activeJob?.dealFile?.methods)) ? (
                                     <a 
                                        href={emailLink}
                                        style={{display:'block', textAlign:'center', background:'#16a34a', color:'white', textDecoration:'none', padding:'10px', borderRadius:'4px', marginTop:'10px', fontWeight:'bold'}}
                                     >
                                         📧 CREATE EMAIL
                                     </a>
                                 ) : (
                                     <div style={{textAlign:'center', padding:'10px', background:'#eee', color:'#999', borderRadius:'4px', marginTop:'10px'}}>⚠️ Upload Docs First</div>
                                 )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px', background: 'white', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'center', gap: '15px', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', flexWrap: 'wrap' }}>
                <button onClick={() => saveToCloud('ESTIMATE')} disabled={saveStatus === 'SAVING'} style={saveStatus === 'SUCCESS' ? successBtn : primaryBtn}>{saveStatus === 'SAVING' ? 'SAVING...' : (saveStatus === 'SUCCESS' ? '✅ SAVED!' : 'SAVE ESTIMATE')}</button>
                {mode === 'ESTIMATE' && (
                    <>
                        {parseFloat(excess) > 0 ? (
                            <>
                                <button onClick={() => saveToCloud('INVOICE_MAIN')} style={{...secondaryBtn, background: '#4338ca'}}>INVOICE INSURER</button>
                                <button onClick={() => saveToCloud('INVOICE_EXCESS')} style={{...secondaryBtn, background: '#be123c'}}>INVOICE CUSTOMER</button>
                            </>
                        ) : (
                            <button onClick={() => saveToCloud('INVOICE')} style={secondaryBtn}>GENERATE INVOICE</button>
                        )}
                    </>
                )}
                <button onClick={() => setMode('JOBCARD')} style={{...secondaryBtn, background: '#4b5563'}}>JOB CARD</button>
                {mode === 'INVOICE' && <button onClick={() => setMode('SATISFACTION')} style={{...secondaryBtn, background: '#d97706'}}>SATISFACTION NOTE</button>}
                <button onClick={() => setMode('DEAL_FILE')} style={{...secondaryBtn, background: '#7c3aed'}}>📂 DEAL FILE</button>
                <button onClick={handlePrint} style={{...secondaryBtn, background: '#333'}}>PRINT</button>
                <button onClick={clearForm} style={{...secondaryBtn, background: '#ef4444'}}>NEW JOB</button>
                <button onClick={() => setMode('SETTINGS')} style={{...secondaryBtn, background: '#666'}}>⚙️</button>
                <button onClick={() => setMode('DASHBOARD')} style={{...secondaryBtn, background: '#0f766e'}}>📊</button>
            </div>

            <div className="no-print" style={{marginTop:'100px', paddingBottom:'80px'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #eee', marginBottom:'15px'}}>
                    <h3 style={{color:'#888'}}>Recent Jobs</h3>
                    <input placeholder="Search jobs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} />
                    <button onClick={downloadAccountingCSV} style={{background:'#0f766e', color:'white', border:'none', padding:'8px 15px', borderRadius:'4px', cursor:'pointer', fontSize:'0.9em'}}>📥 Export CSV</button>
                </div>
                {filteredEstimates.map(est => (
                    <div key={est.id} style={{padding:'10px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center', backgroundColor: est.status === 'PAID' ? '#f0fdf4' : 'transparent'}}>
                        <div onClick={() => loadJobIntoState(est)} style={{cursor:'pointer', color: est.type && est.type.includes('INVOICE') ? '#16a34a' : '#333'}}>
                            <span>{est.type && est.type.includes('INVOICE') ? `📄 ${est.invoiceNumber}` : '📝 Estimate'} - {est.customer} ({est.reg})</span>
                            <div style={{fontSize:'0.8em', color:'#666'}}>{new Date(est.createdAt?.seconds * 1000).toLocaleDateString()} - £{est.totals?.finalDue.toFixed(2)} {est.type && est.type.includes('EXCESS') ? '(EXCESS)' : ''}</div>
                        </div>
                        <div style={{display:'flex', gap:'5px'}}>
                            <button onClick={() => deleteJob(est.id)} style={{border:'none', background:'none', color:'#ef4444', fontSize:'1.2em', cursor:'pointer'}}>🗑️</button>
                            <button onClick={() => togglePaid(est.id, est.status)} style={{padding:'5px 10px', border:'1px solid #ccc', borderRadius:'4px', background: est.status === 'PAID' ? '#16a34a' : 'white', color: est.status === 'PAID' ? 'white' : '#333', cursor:'pointer'}}>{est.status === 'PAID' ? 'PAID' : 'MARK PAID'}</button>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`@media print { 
                .no-print { display: none !important; } 
                body { padding: 0; margin: 0; -webkit-print-color-adjust: exact; } 
                input, textarea, select { 
                    border: none !important; 
                    background: transparent !important;
                    resize: none; 
                    padding: 0 !important; 
                    font-family: inherit;
                    font-size: inherit;
                    font-weight: inherit;
                    color: black !important;
                }
                input::placeholder, textarea::placeholder { color: transparent; }
                canvas { border: 1px solid #000 !important; }
            }`}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => onAuthStateChanged(auth, (user) => user ? sU(user.uid) : signInAnonymously(auth)), []);
    if (!u) return <div style={{padding:'20px'}}>Loading System...</div>;
    return <EstimateApp userId={u} />;
};

export default App;
