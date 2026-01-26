import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ==========================================
// 🔑 DVLA API KEY (Hardcoded & Verified)
// ==========================================
const HARDCODED_DVLA_KEY = "IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc"; 

// --- INTERNAL AXIOS ENGINE ---
const axios = {
    post: async (url, data, config) => {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...config.headers
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`DVLA Error: ${response.status}`);
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

// --- THEME & STYLES ---
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

    const [items, setItems] = useState([]); const [itemDesc, setItemDesc] = useState(''); const [itemCostPrice, setItemCostPrice] = useState('');
    const [photos, setPhotos] = useState([]); const [uploading, setUploading] = useState(false); const [paintAllocated, setPaintAllocated] = useState('');
    const [laborHours, setLaborHours] = useState(''); const [excess, setExcess] = useState('');
    
    const [savedEstimates, setSavedEstimates] = useState([]); const [generalExpenses, setGeneralExpenses] = useState([]);
    const [saveStatus, setSaveStatus] = useState('IDLE'); const [logoError, setLogoError] = useState(false); const [searchTerm, setSearchTerm] = useState('');
    const canvasRef = useRef(null); const [isDrawing, setIsDrawing] = useState(false); const [currentJobId, setCurrentJobId] = useState(null);
    const [methodsRequired, setMethodsRequired] = useState(false);

    const activeJob = useMemo(() => savedEstimates.find(j => j.id === currentJobId), [savedEstimates, currentJobId]);
    const isDealFileReady = useMemo(() => activeJob?.dealFile?.auth && activeJob?.dealFile?.terms && activeJob?.dealFile?.satisfaction, [activeJob]);

    // --- EFFECTS ---
    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => { if(snap.exists()) { setSettings(prev => ({...prev, ...snap.data(), dvlaKey: HARDCODED_DVLA_KEY})); }});
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setSavedEstimates(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snap) => setGeneralExpenses(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    }, []);

    // --- DVLA LOOKUP (STABLE BASELINE) ---
    const lookupReg = async () => {
        if (!reg || reg.length < 3) return alert("Enter Reg");
        setIsLookingUp(true);
        const targetUrl = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

        try {
            const response = await axios.post(proxyUrl, { registrationNumber: reg }, {
                headers: { 'x-api-key': HARDCODED_DVLA_KEY }
            });
            const data = response.data;
            setMakeModel(`${data.make} ${data.colour}`);
            setVehicleInfo(data);
            alert("✅ Vehicle Found!");
        } catch (error) {
            console.error(error);
            alert("⚠️ Connection issue. Manual Entry Mode Enabled.");
            setMakeModel("Manual Entry Required");
        } finally { setIsLookingUp(false); }
    };

    // --- CORE FUNCTIONS ---
    const handleRegChange = (e) => { setReg(e.target.value.toUpperCase()); setFoundHistory(false); };
    const checkHistory = async (r) => { if(r.length < 3) return; const q = query(collection(db, 'estimates'), where("reg", "==", r), orderBy('createdAt', 'desc')); const s = await getDocs(q); if(!s.empty){ const p = s.docs[0].data(); setMakeModel(p.makeModel||''); setName(p.customer||''); setFoundHistory(true); } };
    const handlePrint = () => { if (mode === 'DEAL_FILE' || mode === 'SETTINGS') setMode('INVOICE'); setTimeout(() => window.print(), 500); };
    const addToGoogleCalendar = () => { if(!bookingDate) return; window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=Repair:${reg}&dates=${bookingDate.replace(/-/g, '')}/${bookingDate.replace(/-/g, '')}`, '_blank'); };
    
    const addItem = () => { if (!itemDesc) return; const c = parseFloat(itemCostPrice)||0; setItems([...items, { desc: itemDesc, costPrice: c, price: c * (1 + (parseFloat(settings.markup)/100)) }]); setItemDesc(''); setItemCostPrice(''); };
    const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
    const calculateTotals = () => {
        const pP = items.reduce((acc, i) => acc + i.price, 0); 
        const pC = items.reduce((acc, i) => acc + i.costPrice, 0);
        const l = (parseFloat(laborHours)||0) * (parseFloat(settings.laborRate)||0);
        const inv = pP + l;
        return { partsPrice: pP, partsCost: pC, labor: l, invoiceTotal: inv, finalDue: inv - (parseFloat(excess)||0), jobProfit: inv - (pC + (parseFloat(paintAllocated)||0)) };
    };
    const totals = calculateTotals();

    const loadJobIntoState = (est) => {
        setCurrentJobId(est.id); setName(est.customer); setReg(est.reg); setMakeModel(est.makeModel||''); setMode('ESTIMATE');
    };

    const saveToCloud = async (t) => {
        if(!name||!reg) return alert("Enter Name & Reg");
        setSaveStatus('SAVING');
        try {
            let inv = invoiceNum; if(t.includes('INVOICE')&&!inv) inv = `INV-${Date.now().toString().slice(-4)}`;
            const docRef = await addDoc(collection(db, 'estimates'), { 
                customer: name, reg, totals: calculateTotals(), createdAt: serverTimestamp(), type: t, invoiceNumber: inv, dealFile: { methodsRequired: false } 
            });
            setCurrentJobId(docRef.id); setSaveStatus('SUCCESS'); setTimeout(() => setSaveStatus('IDLE'), 2000);
        } catch(e) { alert(e.message); setSaveStatus('IDLE'); }
    };

    const uploadDoc = async (type, file) => {
        if(!currentJobId) return alert("Save job first");
        const r = ref(storage, `deal_docs/${currentJobId}/${type}_${file.name}`);
        await uploadBytes(r, file); const u = await getDownloadURL(r);
        await updateDoc(doc(db, 'estimates', currentJobId), { [`dealFile.${type}`]: { name: file.name, url: u } });
        alert("Uploaded");
    };

    // --- SIGNATURES ---
    const startDrawing = ({nativeEvent}) => { const {offsetX, offsetY} = getCo(nativeEvent); const ctx = canvasRef.current.getContext('2d'); ctx.lineWidth=3; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(offsetX, offsetY); setIsDrawing(true); };
    const draw = ({nativeEvent}) => { if(!isDrawing) return; const {offsetX, offsetY} = getCo(nativeEvent); canvasRef.current.getContext('2d').lineTo(offsetX, offsetY); canvasRef.current.getContext('2d').stroke(); };
    const stopDrawing = () => { canvasRef.current.getContext('2d').closePath(); setIsDrawing(false); };
    const getCo = (e) => { if (e.touches && e.touches[0]) { const rect = canvasRef.current.getBoundingClientRect(); return { offsetX: e.touches[0].clientX - rect.left, offsetY: e.touches[0].clientY - rect.top }; } return { offsetX: e.offsetX, offsetY: e.offsetY }; };

    if(mode === 'SETTINGS') return (
        <div style={{padding:'20px', maxWidth:'600px', margin:'0 auto'}}>
            <button onClick={() => setMode('ESTIMATE')} style={secondaryBtn}>← Back</button>
            <h2 style={{color:theme.primary}}>⚙️ Shop Settings</h2>
            <label>Labor Rate £/hr <input value={settings.laborRate} onChange={e=>setSettings({...settings, laborRate:e.target.value})} style={inputStyle}/></label>
            <label>Parts Markup % <input value={settings.markup} onChange={e=>setSettings({...settings, markup:e.target.value})} style={inputStyle}/></label>
            <label>Address <textarea value={settings.address} onChange={e=>setSettings({...settings, address:e.target.value})} style={{...inputStyle, height:'60px'}}/></label>
            <button onClick={() => { setDoc(doc(db, 'settings', 'global'), settings); alert("Saved"); }} style={greenBtn}>SAVE</button>
        </div>
    );

    return (
        <div style={{padding:'20px', maxWidth:'850px', margin:'0 auto', fontFamily:'Arial', paddingBottom:'100px'}}>
            {/* HEADER */}
            <div style={{display:'flex', justifyContent:'space-between', borderBottom:`4px solid ${theme.primary}`, paddingBottom:'10px', marginBottom:'20px'}}>
                <div>{!logoError ? <img src={process.env.PUBLIC_URL + "/1768838821897.png"} style={{maxHeight:'80px'}} onError={()=>setLogoError(true)}/> : <h1 style={{color:theme.primary}}>TRIPLE MMM</h1>}</div>
                <div style={{textAlign:'right', fontSize:'0.8em'}}>{settings.address}<br/>{settings.phone}</div>
            </div>

            {/* INPUTS */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                <div>
                    <h4 style={headerStyle}>CLIENT & INSURANCE</h4>
                    <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} style={inputStyle}/>
                    <input placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} style={inputStyle}/>
                    <input placeholder="Insurer" value={insuranceCo} onChange={e=>setInsuranceCo(e.target.value)} style={inputStyle}/>
                    <input placeholder="Claim #" value={claimNum} onChange={e=>setClaimNum(e.target.value)} style={inputStyle}/>
                </div>
                <div>
                    <h4 style={headerStyle}>VEHICLE</h4>
                    <div style={{display:'flex', gap:'5px'}}>
                        <input placeholder="REG" value={reg} onChange={handleRegChange} onBlur={()=>checkHistory(reg)} style={{...inputStyle, fontWeight:'bold', textTransform:'uppercase'}}/>
                        <button onClick={lookupReg} style={{height:'40px', background:theme.primary, color:'white', border:'none', borderRadius:'6px', padding:'0 15px'}}>{isLookingUp ? '...' : '🔎'}</button>
                    </div>
                    {vehicleInfo && <div style={{fontSize:'0.8em', background:theme.light, padding:'10px', borderRadius:'6px', marginBottom:'10px', border:'1px dashed orange'}}><strong>{vehicleInfo.make} {vehicleInfo.colour}</strong><br/>{vehicleInfo.yearOfManufacture} | {vehicleInfo.fuelType}</div>}
                    <input placeholder="Make/Model" value={makeModel} onChange={e=>setMakeModel(e.target.value)} style={inputStyle}/>
                    <input placeholder="VIN" value={vin} onChange={e=>setVin(e.target.value)} style={inputStyle}/>
                </div>
            </div>

            {/* ITEMS */}
            <div style={{marginTop:'30px'}}>
                <div className="no-print" style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                    <input placeholder="Item Description" value={itemDesc} onChange={e=>setItemDesc(e.target.value)} style={{flex:1, ...inputStyle}}/>
                    <input placeholder="£ Cost" type="number" value={itemCostPrice} onChange={e=>setItemCostPrice(e.target.value)} style={{width:'100px', ...inputStyle}}/>
                    <button onClick={addItem} style={greenBtn}>+</button>
                </div>
                <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead><tr style={{textAlign:'left', borderBottom:'2px solid black'}}><th>Description</th><th style={{textAlign:'right'}}>Price</th></tr></thead>
                    <tbody>{items.map((it, i) => (<tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'10px 0'}}>{it.desc}</td><td style={{textAlign:'right'}}>£{it.price.toFixed(2)}</td><td className="no-print"><button onClick={()=>removeItem(i)} style={{color:'red', border:'none', background:'none'}}>x</button></td></tr>))}</tbody>
                </table>
            </div>

            {/* FINANCIALS */}
            <div style={{display:'flex', justifyContent:'flex-end', marginTop:'30px'}}>
                <div style={{width:'300px', textAlign:'right'}}>
                    <div className="no-print">Labor: <input type="number" value={laborHours} onChange={e=>setLaborHours(e.target.value)} style={{width:'60px'}}/> hrs</div>
                    <div style={rowStyle}><span>Labor Total:</span><strong>£{totals.labor.toFixed(2)}</strong></div>
                    <div style={rowStyle}><span>Parts Total:</span><strong>£{totals.partsPrice.toFixed(2)}</strong></div>
                    <div style={{...rowStyle, color:'red'}}><span>Less Excess:</span><span>-£{(parseFloat(excess)||0).toFixed(2)}</span><input type="number" className="no-print" value={excess} onChange={e=>setExcess(e.target.value)} style={{width:'60px'}}/></div>
                    <div style={{...rowStyle, fontSize:'1.4em', background:'#eee', padding:'10px', borderRadius:'6px', marginTop:'10px'}}><span>DUE:</span><strong>£{totals.finalDue.toFixed(2)}</strong></div>
                    <div className="no-print" style={{marginTop:'10px', padding:'10px', border:'1px dashed #ccc'}}>Internal Paint Cost: £<input type="number" value={paintAllocated} onChange={e=>setPaintAllocated(e.target.value)} style={{width:'70px', border:'none'}}/></div>
                </div>
            </div>

            {/* FOOTER: SIGNATURES */}
            {mode === 'INVOICE' && (
                <div style={{marginTop:'40px', borderTop:'1px solid #ccc', paddingTop:'20px', display:'flex', justifyContent:'space-between'}}>
                    <div style={{width:'60%'}}><h4>PAYMENT</h4><p>Bank: BANK OF SCOTLAND<br/>Acc: 06163462 | Sort: 80-22-60<br/>Name: {settings.companyName}</p></div>
                    <div style={{textAlign:'center'}}><div className="no-print" style={{border:'1px dashed #ccc', height:'60px', width:'200px'}}><canvas ref={canvasRef} width={200} height={60} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}/></div><div style={{borderBottom:'1px solid black'}}></div>Signed</div>
                </div>
            )}

            {/* DEAL FILE */}
            {mode === 'DEAL_FILE' && (
                <div style={{marginTop:'20px', padding:'20px', background:theme.light, borderRadius:'12px', border:`1px solid ${theme.border}`}}>
                    <h2 style={{color:theme.dark}}>📂 Digital Deal File</h2>
                    {['auth', 'satisfaction', 'terms'].map(type => (
                        <div key={type} style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', borderBottom:'1px solid #eee', paddingBottom:'5px'}}>
                            <strong>{type.toUpperCase()}</strong>
                            <div>{activeJob?.dealFile?.[type] ? '✅' : '❌'}<input type="file" onChange={(e)=>uploadDoc(type, e.target.files[0])} style={{fontSize:'0.8em', marginLeft:'10px'}}/></div>
                        </div>
                    ))}
                </div>
            )}

            {/* ACTION BAR */}
            <div className="no-print" style={{position:'fixed', bottom:0, left:0, right:0, background:'white', padding:'15px', display:'flex', gap:'10px', borderTop:'1px solid #ddd', overflowX:'auto', zIndex:1000}}>
                <button onClick={()=>saveToCloud('ESTIMATE')} style={saveStatus==='SUCCESS'?greenBtn:primaryBtn}>{saveStatus==='SAVING'?'...':'SAVE'}</button>
                <button onClick={()=>setMode('JOBCARD')} style={secondaryBtn}>Job Card</button>
                <button onClick={()=>setMode('DEAL_FILE')} style={{...secondaryBtn, background:theme.primary}}>File</button>
                <button onClick={handlePrint} style={secondaryBtn}>Print</button>
                <button onClick={()=>setMode('SETTINGS')} style={secondaryBtn}>⚙️</button>
                <button onClick={()=>window.location.reload()} style={{...secondaryBtn, background:theme.red}}>New</button>
            </div>

            {/* HISTORY */}
            <div className="no-print" style={{marginTop:'40px'}}>
                <h3>Recent Jobs</h3>
                {savedEstimates.map(e => (
                    <div key={e.id} onClick={()=>loadJobIntoState(e)} style={{padding:'10px', borderBottom:'1px solid #eee', cursor:'pointer'}}><strong>{e.reg}</strong> - {e.customer}</div>
                ))}
            </div>
            <style>{`@media print {.no-print {display:none !important}}`}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => onAuthStateChanged(auth, (user) => user ? sU(user.uid) : signInAnonymously(auth)), []);
    if (!u) return <div style={{padding:'20px', color:theme.primary}}>Loading Triple MMM...</div>;
    return <EstimateApp userId={u} />;
};

export default App;
