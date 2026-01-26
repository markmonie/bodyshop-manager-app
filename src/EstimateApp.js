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
    
    // Data Fields
    const [name, setName] = useState(''); const [address, setAddress] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState('');
    const [claimNum, setClaimNum] = useState(''); const [networkCode, setNetworkCode] = useState(''); const [insuranceCo, setInsuranceCo] = useState(''); const [insuranceAddr, setInsuranceAddr] = useState(''); const [insuranceEmail, setInsuranceEmail] = useState('');
    const [reg, setReg] = useState(''); const [mileage, setMileage] = useState(''); const [makeModel, setMakeModel] = useState(''); const [vin, setVin] = useState(''); const [paintCode, setPaintCode] = useState('');
    const [vehicleInfo, setVehicleInfo] = useState(null); const [bookingDate, setBookingDate] = useState(''); const [bookingTime, setBookingTime] = useState('09:00'); 
    const [foundHistory, setFoundHistory] = useState(false); const [axiosReady, setAxiosReady] = useState(false);
    
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

    // --- EFFECT: Inject Real Axios ---
    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js";
        script.async = true;
        script.onload = () => { console.log("Axios Loaded"); setAxiosReady(true); };
        document.body.appendChild(script);
        return () => { document.body.removeChild(script); }
    }, []);

    // --- EFFECT: Firebase ---
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

    // --- CORE FUNCTIONS ---
    const loadJobIntoState = (est) => {
        setCurrentJobId(est.id); setName(est.customer); setAddress(est.address||''); setPhone(est.phone||''); setEmail(est.email||''); setReg(est.reg); setMileage(est.mileage||''); setMakeModel(est.makeModel||''); setVin(est.vin||''); setPaintCode(est.paintCode||''); setClaimNum(est.claimNum||''); setNetworkCode(est.networkCode||''); setInsuranceCo(est.insuranceCo||''); setInsuranceAddr(est.insuranceAddr||''); setInsuranceEmail(est.insuranceEmail||''); setItems(est.items||[]); setLaborHours(est.laborHours||''); setLaborRate(est.laborRate||settings.laborRate); setVatRate(est.vatRate||settings.vatRate); setExcess(est.excess||''); setPhotos(est.photos||[]); setBookingDate(est.bookingDate||''); setBookingTime(est.bookingTime||'09:00'); setPaintAllocated(est.paintAllocated||''); setInvoiceNum(est.invoiceNumber||''); setVehicleInfo(est.vehicleInfo||null); setMethodsRequired(est.dealFile?.methodsRequired||false); setMode('DEAL_FILE'); window.scrollTo(0, 0);
    };

    const lookupReg = async () => {
        if (!reg || reg.length < 3) return alert("Enter Reg");
        if (!axiosReady) return alert("System loading... please wait 2 seconds and try again.");
        
        const apiKey = HARDCODED_DVLA_KEY;
        // Use secure proxy to bypass Government Block
        const targetUrl = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);

        try {
            // Use the REAL window.axios library we injected
            const response = await window.axios.post(proxyUrl, { registrationNumber: reg }, {
                headers: { 'x-api-key': apiKey }
            });

            const data = response.data;
            setMakeModel(`${data.make} ${data.colour}`);
            setVehicleInfo(data); 
            if(data.vin) setVin(data.vin); 
            alert("✅ Vehicle Found!");

        } catch (e) {
            console.error(e);
            alert("❌ DVLA Lookup Failed.\n\nConnection blocked by Government API. Please enter details manually.");
            setMakeModel("Manual Entry Required");
            setVehicleInfo({ make: "CONNECTION BLOCKED", colour: "N/A", yearOfManufacture: "N/A", fuelType: "N/A" });
        }
    };

    const decodeVin = () => { if (!vin && !makeModel) return alert("Enter VIN or Find Vehicle"); if (vin && vin.length > 2) { const wmi = vin.toUpperCase().substring(0, 3); if (wmi.startsWith('WBA')||wmi.startsWith('WMW')||wmi.startsWith('WBS')) { window.open(`https://www.mdecoder.com/decode/${vin}`, '_blank'); return; } if (wmi.startsWith('WDD')||wmi.startsWith('WDB')) { window.open(`https://www.lastvin.com/vin/${vin}`, '_blank'); return; } } window.open(`https://www.paintcode.co.uk/search/${makeModel?makeModel.split(' ')[0]:'Car'}`, '_blank'); };
    const decodeParts = () => { if (!vin || vin.length < 3) return alert("Enter VIN"); window.open(`https://partsouq.com/en/catalog/genuine/locate?c=${vin}`, '_blank'); };
    const addItem = () => { if (!itemDesc) return; const cost = parseFloat(itemCostPrice)||0; setItems([...items, { desc: itemDesc, costPrice: cost, price: cost * (1 + (parseFloat(settings.markup)/100)) }]); setItemDesc(''); setItemCostPrice(''); };
    const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
    const calculateJobFinancials = () => { const partsPrice = items.reduce((acc, i) => acc + i.price, 0); const partsCost = items.reduce((acc, i) => acc + i.costPrice, 0); const labor = (parseFloat(laborHours)||0) * (parseFloat(laborRate)||0); const paintCost = parseFloat(paintAllocated)||0; const invTotal = partsPrice + labor; const jobCost = partsCost + paintCost; return { partsPrice, partsCost, labor, paintCost, invoiceTotal: invTotal, totalJobCost: jobCost, jobProfit: invTotal - jobCost, excessAmount: (parseFloat(excess)||0), finalDue: invTotal - (parseFloat(excess)||0) }; };
    const totals = calculateJobFinancials();
    
    const saveToCloud = async (type) => {
        if(!name || !reg) return alert("Enter Name & Reg");
        setSaveStatus('SAVING');
        try {
            let inv = invoiceNum; if(type.includes('INVOICE') && !inv) { inv = `INV-${1000+savedEstimates.length+1}`; setInvoiceNum(inv); setInvoiceDate(new Date().toLocaleDateString()); }
            if(type === 'INVOICE_MAIN') { setMode('INVOICE'); setInvoiceType('MAIN'); } else if (type === 'INVOICE_EXCESS') { setMode('INVOICE'); setInvoiceType('EXCESS'); } else { setMode(type); }
            const docRef = await addDoc(collection(db, 'estimates'), { type: type.includes('INVOICE')?'INVOICE':type, status: 'UNPAID', invoiceNumber: inv, customer: name, address, phone, email, claimNum, networkCode, insuranceCo, insuranceAddr, insuranceEmail, reg, mileage, makeModel, vin, paintCode, items, laborHours, laborRate, vatRate, excess, photos, bookingDate, bookingTime, paintAllocated, vehicleInfo: vehicleInfo || {}, totals: calculateJobFinancials(), createdAt: serverTimestamp(), createdBy: userId, dealFile: { methodsRequired: false } });
            setCurrentJobId(docRef.id); setSaveStatus('SUCCESS'); setTimeout(() => setSaveStatus('IDLE'), 3000);
        } catch(e) { alert("Error: " + e.message); setSaveStatus('IDLE'); }
    };

    const clearForm = () => { if(window.confirm("Start fresh?")) { setMode('ESTIMATE'); setInvoiceNum(''); setName(''); setReg(''); setItems([]); setPhotos([]); setPaintAllocated(''); setClaimNum(''); setNetworkCode(''); setInsuranceCo(''); setInsuranceAddr(''); setInsuranceEmail(''); setSaveStatus('IDLE'); setCurrentJobId(null); setVehicleInfo(null); } };
    const handlePhotoUpload = async (e) => { const files = Array.from(e.target.files); setUploading(true); await Promise.all(files.map(async (file) => { const r = ref(storage, `damage_photos/${Date.now()}_${file.name}`); await uploadBytes(r, file); const u = await getDownloadURL(r); setPhotos(prev => [...prev, u]); })); setUploading(false); };
    const removePhoto = (i) => setPhotos(photos.filter((_, idx) => idx !== i));
    const startDrawing = ({nativeEvent}) => { const {offsetX, offsetY} = getCoordinates(nativeEvent); const ctx = canvasRef.current.getContext('2d'); ctx.lineWidth=3; ctx.lineCap='round'; ctx.strokeStyle='#000'; ctx.beginPath(); ctx.moveTo(offsetX, offsetY); setIsDrawing(true); };
    const draw = ({nativeEvent}) => { if(!isDrawing) return; const {offsetX, offsetY} = getCoordinates(nativeEvent); canvasRef.current.getContext('2d').lineTo(offsetX, offsetY); canvasRef.current.getContext('2d').stroke(); };
    const stopDrawing = () => { const ctx = canvasRef.current.getContext('2d'); ctx.closePath(); setIsDrawing(false); };
    const getCoordinates = (event) => { if (event.touches && event.touches[0]) { const rect = canvasRef.current.getBoundingClientRect(); return { offsetX: event.touches[0].clientX - rect.left, offsetY: event.touches[0].clientY - rect.top }; } return { offsetX: event.offsetX, offsetY: event.offsetY }; };
    const clearSignature = () => { if(canvasRef.current) canvasRef.current.getContext('2d').clearRect(0, 0, 200, 60); };
    useEffect(() => clearSignature(), [mode]);
    const uploadFile = async (type, file) => { if(!currentJobId) return alert("Save First"); const r = ref(storage, `deal_docs/${currentJobId}/${type}_${file.name}`); await uploadBytes(r, file); const u = await getDownloadURL(r); await updateDoc(doc(db, 'estimates', currentJobId), { [`dealFile.${type}`]: { name: file.name, url: u } }); alert("Uploaded"); };
    const deleteJob = async (id) => { if(window.confirm("Delete?")) await deleteDoc(doc(db, 'estimates', id)); };
    const togglePaid = async (id, s) => { await updateDoc(doc(db, 'estimates', id), { status: s === 'PAID' ? 'UNPAID' : 'PAID' }); };
    
    // --- VIEWS ---
    if(mode === 'SETTINGS') return <div style={{padding:'20px', maxWidth:'600px', margin:'0 auto'}}><button onClick={()=>setMode('ESTIMATE')} style={secondaryBtn}>← Back</button><h2>⚙️ Settings</h2><label>Rate £/hr <input value={settings.laborRate} onChange={e=>setSettings({...settings, laborRate:e.target.value})} style={inputStyle}/></label><label>Markup % <input value={settings.markup} onChange={e=>setSettings({...settings, markup:e.target.value})} style={inputStyle}/></label><div style={{padding:'10px', background:'#f0fdf4', border:'1px solid green', borderRadius:'6px', marginBottom:'10px'}}>DVLA Key: <strong>ACTIVE (Hardcoded)</strong></div><label>Address <textarea value={settings.address} onChange={e=>setSettings({...settings, address:e.target.value})} style={{...inputStyle, height:'60px'}}/></label><label>T&Cs <textarea value={settings.terms} onChange={e=>setSettings({...settings, terms:e.target.value})} style={{...inputStyle, height:'100px'}}/></label><button onClick={()=>{setDoc(doc(db, 'settings', 'global'), settings); alert("Saved");}} style={greenBtn}>SAVE</button></div>;
    if(mode === 'DASHBOARD') return <div style={{padding:'20px', maxWidth:'800px', margin:'0 auto'}}><button onClick={()=>setMode('ESTIMATE')} style={secondaryBtn}>← Back</button><h2>📊 Dashboard</h2><div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}><div style={{padding:'15px', background:theme.light}}>Sales: <strong>£{savedEstimates.filter(e=>e.type?.includes('INVOICE')).reduce((a,b)=>a+(b.totals?.finalDue||0),0).toFixed(2)}</strong></div><div style={{padding:'15px', background:'#ecfccb'}}>Profit: <strong>£{savedEstimates.filter(e=>e.type?.includes('INVOICE')).reduce((a,b)=>a+(b.totals?.jobProfit||0),0).toFixed(2)}</strong></div></div></div>;

    return (
        <div style={{padding:'20px', maxWidth:'900px', margin:'0 auto', paddingBottom:'100px', fontFamily:'Arial'}}>
            {mode!=='ESTIMATE' && <button onClick={()=>setMode('ESTIMATE')} className="no-print" style={{...secondaryBtn, marginBottom:'10px'}}>← Back</button>}
            <div style={{display:'flex', justifyContent:'space-between', borderBottom:`4px solid ${theme.primary}`, paddingBottom:'20px', marginBottom:'20px'}}><div>{!logoError ? <img src={process.env.PUBLIC_URL + "/1768838821897.png"} style={{maxHeight:'100px'}} onError={()=>setLogoError(true)}/> : <h1>TRIPLE MMM</h1>}</div><div style={{textAlign:'right', fontSize:'0.9em'}}>{settings.address}<br/>{settings.phone}<br/>{settings.email}</div></div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'20px'}}><h2 style={{margin:0, color:theme.text}}>{mode==='DEAL_FILE'?'📂 DEAL FILE':mode}</h2>{mode!=='ESTIMATE' && <div style={{textAlign:'right'}}><strong>{invoiceNum}</strong><br/>{invoiceDate||new Date().toLocaleDateString()}</div>}</div>

            {mode !== 'DEAL_FILE' && <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', border:`1px solid ${theme.grey}`, padding:'20px', borderRadius:'12px'}}>
                <div><h4 style={headerStyle}>CLIENT</h4><input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} style={inputStyle}/><textarea placeholder="Address" value={address} onChange={e=>setAddress(e.target.value)} style={{...inputStyle, height:'60px'}}/><div style={{display:'flex', gap:'5px'}}><input placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} style={inputStyle}/><input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle}/></div>{excess > 0 && <div className="no-print" style={{marginTop:'10px', padding:'10px', background:'#f8fafc', borderLeft:`4px solid ${theme.primary}`}}><input placeholder="Insurer" value={insuranceCo} onChange={e=>setInsuranceCo(e.target.value)} style={inputStyle}/><div style={{display:'flex', gap:'5px'}}><input placeholder="Claim #" value={claimNum} onChange={e=>setClaimNum(e.target.value)} style={inputStyle}/><input placeholder="Network Code" value={networkCode} onChange={e=>setNetworkCode(e.target.value)} style={inputStyle}/></div><input placeholder="Insurer Email" value={insuranceEmail} onChange={e=>setInsuranceEmail(e.target.value)} style={inputStyle}/></div>}</div>
                <div><h4 style={headerStyle}>VEHICLE</h4><div style={{display:'flex', gap:'5px'}}><input placeholder="REG" value={reg} onChange={handleRegChange} onBlur={()=>checkHistory(reg)} style={{...inputStyle, fontWeight:'bold', textTransform:'uppercase'}}/><button onClick={lookupReg} className="no-print" style={secondaryBtn}>{axiosReady?'🔎':'...'}</button></div>{foundHistory && <div style={{color:'green', fontSize:'0.8em'}}>✓ Found</div>}{vehicleInfo && <div style={{fontSize:'0.8em', background:theme.light, padding:'10px', borderRadius:'6px', marginBottom:'10px'}}><strong>{vehicleInfo.make} {vehicleInfo.colour}</strong><br/>{vehicleInfo.yearOfManufacture}</div>}<input placeholder="Make/Model" value={makeModel} onChange={e=>setMakeModel(e.target.value)} style={inputStyle}/><div style={{display:'flex', gap:'5px'}}><input placeholder="VIN" value={vin} onChange={e=>setVin(e.target.value)} style={inputStyle}/><button onClick={decodeVin} className="no-print" style={secondaryBtn}>🎨</button><button onClick={decodeParts} className="no-print" style={{...secondaryBtn, background:theme.primary}}>🔧</button></div><input placeholder="Paint Code" value={paintCode} onChange={e=>setPaintCode(e.target.value)} style={inputStyle}/><div className="no-print" style={{marginTop:'10px', borderTop:'1px dashed #ccc', paddingTop:'10px'}}><input type="date" value={bookingDate} onChange={e=>setBookingDate(e.target.value)} style={inputStyle}/><button onClick={addToGoogleCalendar} style={{...secondaryBtn, width:'100%'}}>📅 Add to Calendar</button></div></div>
            </div>}

            {photos.length > 0 && mode !== 'DEAL_FILE' && <div style={{display:'flex', gap:'10px', overflowX:'auto', margin:'20px 0'}}>{photos.map((u,i)=><div key={i} style={{position:'relative', minWidth:'100px'}}><img src={u} style={{height:'100px', borderRadius:'6px'}}/><button className="no-print" onClick={()=>removePhoto(i)} style={{position:'absolute', top:0, right:0, background:'red', color:'white', border:'none'}}>x</button></div>)}</div>}
            {mode !== 'DEAL_FILE' && <div className="no-print" style={{margin:'10px 0'}}><input type="file" multiple onChange={handlePhotoUpload}/></div>}

            {mode !== 'DEAL_FILE' && mode !== 'SATISFACTION' && <>
                {invoiceType !== 'EXCESS' && <><div className="no-print" style={{display:'flex', gap:'10px', margin:'20px 0'}}><input placeholder="Item" value={itemDesc} onChange={e=>setItemDesc(e.target.value)} style={{...inputStyle, flex:1}}/><input type="number" placeholder="Cost" value={itemCostPrice} onChange={e=>setItemCostPrice(e.target.value)} style={{...inputStyle, width:'100px'}}/><button onClick={addItem} style={greenBtn}>Add</button></div><table style={{width:'100%', borderCollapse:'collapse', marginBottom:'20px'}}><thead><tr style={{textAlign:'left', borderBottom:`2px solid ${theme.text}`}}><th style={{padding:'10px'}}>DESC</th>{mode!=='JOBCARD' && <th style={{textAlign:'right'}}>PRICE</th>}</tr></thead><tbody>{items.map((it,i)=><tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'10px'}}>{it.desc}</td>{mode!=='JOBCARD' && <td style={{textAlign:'right'}}>£{it.price.toFixed(2)}</td>}<td className="no-print"><button onClick={()=>removeItem(i)} style={{color:'red', border:'none', background:'none'}}>x</button></td></tr>)}</tbody></table></>}
                {mode !== 'JOBCARD' && <div style={{display:'flex', justifyContent:'flex-end'}}><div style={{width:'300px', textAlign:'right'}}>{invoiceType !== 'EXCESS' && <><div className="no-print" style={{marginBottom:'5px'}}>Labor: <input type="number" value={laborHours} onChange={e=>setLaborHours(e.target.value)} style={{width:'50px'}}/> hrs</div><div style={rowStyle}><span>Labor:</span><strong>£{totals.labor.toFixed(2)}</strong></div><div style={rowStyle}><span>Parts:</span><strong>£{totals.partsPrice.toFixed(2)}</strong></div><div style={{...rowStyle, borderTop:'2px solid black'}}><span>TOTAL:</span><strong>£{totals.invoiceTotal.toFixed(2)}</strong></div><div style={{...rowStyle, color:'red'}}><span>Less Excess:</span><span className="no-print"><input type="number" value={excess} onChange={e=>setExcess(e.target.value)} style={{width:'60px'}}/></span><span>-£{totals.excessAmount.toFixed(2)}</span></div></>}<div style={{...rowStyle, background:theme.grey, padding:'10px', borderRadius:'6px', fontSize:'1.2em'}}><span>DUE:</span><strong>£{invoiceType==='EXCESS'?totals.excessAmount.toFixed(2):totals.finalDue.toFixed(2)}</strong></div><div className="no-print" style={{marginTop:'10px', padding:'10px', border:`1px dashed ${theme.primary}`}}>Paint Cost: <input type="number" value={paintAllocated} onChange={e=>setPaintAllocated(e.target.value)} style={{width:'80px'}}/></div></div></div>}
            </>}

            {mode === 'INVOICE' && <div style={{marginTop:'40px', borderTop:'1px solid #ccc', paddingTop:'20px', display:'flex', justifyContent:'space-between'}}><div style={{width:'60%'}}><h4>PAYMENT</h4><p>Bank: BANK OF SCOTLAND<br/>Account: 06163462<br/>Sort: 80-22-60<br/>Name: {settings.companyName}</p></div><div style={{textAlign:'center'}}><div className="no-print" style={{border:'1px dashed #ccc', height:'60px', width:'200px', marginBottom:'5px'}}><canvas ref={canvasRef} width={200} height={60} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}/></div><div style={{borderBottom:'1px solid black'}}></div>Signed</div></div>}
            {mode === 'JOBCARD' && <div style={{marginTop:'40px', borderTop:'2px solid #ccc', paddingTop:'20px'}}><h4>TERMS</h4><div style={{fontSize:'0.8em', whiteSpace:'pre-wrap', marginBottom:'30px'}}>{settings.terms}</div><div style={{display:'flex', justifyContent:'space-between'}}><div style={{width:'40%', textAlign:'center', borderTop:'1px solid black'}}>Customer</div><div style={{width:'40%', textAlign:'center', borderTop:'1px solid black'}}>Technician</div></div></div>}

            {mode === 'DEAL_FILE' && <div style={{marginTop:'20px', padding:'20px', background:theme.light, border:`1px solid ${theme.border}`, borderRadius:'12px'}}><h2 style={{color:theme.dark}}>📂 Deal File</h2><div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}><div><h4>Checklist</h4>{['terms', 'auth', 'satisfaction', 'methods'].map(type => <div key={type} style={{marginBottom:'10px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between'}}><strong>{type.toUpperCase()}</strong><div>{activeJob?.dealFile?.[type]?'✅':'❌'}<input type="file" onChange={(e)=>uploadFile(type, e.target.files[0])} style={{fontSize:'0.8em', width:'180px', marginLeft:'10px'}}/>{activeJob?.dealFile?.[type]&&<a href={activeJob.dealFile[type].url} target="_blank" style={{marginLeft:'5px'}}>View</a>}</div></div>)}</div><div><h4>Actions</h4><div style={{marginTop:'20px', paddingTop:'10px', borderTop:'1px dashed #ccc'}}>Send to: <strong>{insuranceEmail || 'No Email'}</strong><button onClick={()=>window.location.href=`mailto:${insuranceEmail||email}?subject=Repair Docs ${reg}&body=Attached.`} disabled={!isDealFileReady} style={{...primaryBtn, width:'100%', marginTop:'10px', background:isDealFileReady?theme.green:theme.disabled}}>{isDealFileReady?'📧 SEND PACK':'⚠️ COMPLETE CHECKLIST'}</button></div></div></div></div>}

            <div className="no-print" style={{position:'fixed', bottom:0, left:0, right:0, background:'white', borderTop:'1px solid #ddd', padding:'15px', display:'flex', gap:'12px', overflowX:'auto', boxShadow:'0 -4px 20px rgba(0,0,0,0.1)'}}><button onClick={()=>saveToCloud('ESTIMATE')} style={saveStatus==='SUCCESS'?successBtn:greenBtn}>{saveStatus==='SAVING'?'⏳':'SAVE'}</button>{mode==='ESTIMATE' && <><button onClick={()=>saveToCloud('INVOICE_MAIN')} style={{...secondaryBtn, background:'#4f46e5'}}>Ins Inv</button><button onClick={()=>saveToCloud('INVOICE_EXCESS')} style={{...secondaryBtn, background:'#be123c'}}>Cust Inv</button></>}<button onClick={()=>setMode('JOBCARD')} style={secondaryBtn}>Job Card</button><button onClick={()=>setMode('DEAL_FILE')} style={{...secondaryBtn, background:theme.primary}}>File</button><button onClick={handlePrint} style={secondaryBtn}>Print</button><button onClick={clearForm} style={{...secondaryBtn, background:'#ef4444'}}>New</button><button onClick={()=>setMode('SETTINGS')} style={secondaryBtn}>⚙️</button><button onClick={()=>setMode('DASHBOARD')} style={secondaryBtn}>📊</button></div>
            <div className="no-print" style={{marginTop:'50px'}}><div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #ddd', marginBottom:'10px'}}><h3>Recent</h3><input placeholder="Search..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} style={{padding:'5px'}}/></div>{savedEstimates.filter(e=>e.reg?.toLowerCase().includes(searchTerm.toLowerCase()) || e.customer?.toLowerCase().includes(searchTerm.toLowerCase())).map(e=><div key={e.id} style={{padding:'10px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', background:e.status==='PAID'?'#f0fdf4':'white'}}><div onClick={()=>loadJobIntoState(e)} style={{cursor:'pointer'}}><strong>{e.reg}</strong> - {e.customer}</div><div><button onClick={()=>togglePaid(e.id, e.status)} style={{marginRight:'5px'}}>{e.status}</button><button onClick={()=>deleteJob(e.id)} style={dangerBtn}>X</button></div></div>)}</div>
            <style>{`@media print { .no-print { display: none !important; } body { padding: 0; } input, textarea { border: none !important; resize: none; font-family: inherit; color: black; } }`}</style>
        </div>
    );
};

const App = () => { const [u, sU] = useState(null); useEffect(() => onAuthStateChanged(auth, (user) => user ? sU(user.uid) : signInAnonymously(auth)), []); if (!u) return <div style={{padding:'20px', color:'#ea580c'}}>Loading...</div>; return <EstimateApp userId={u} />; };
export default App;
