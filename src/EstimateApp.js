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

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => { if(snap.exists()) { const s = snap.data(); setSettings(prev => ({...prev, ...s, dvlaKey: HARDCODED_DVLA_KEY})); }});
        const unsubEst = onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setSavedEstimates(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubExp = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snap) => setGeneralExpenses(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => { unsubEst(); unsubExp(); };
    }, []);

    // --- DVLA LOOKUP (TRIPLE PROXY ATTEMPT) ---
    const lookupReg = async () => {
        if (!reg || reg.length < 3) return alert("Enter Reg");
        setIsLookingUp(true);
        const apiKey = HARDCODED_DVLA_KEY;
        const targetUrl = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
        
        // Proxy List
        const proxies = [
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?',
            'https://thingproxy.freeboard.io/fetch/'
        ];

        let success = false;

        for (const proxy of proxies) {
            if (success) break;
            try {
                const response = await fetch(proxy + encodeURIComponent(targetUrl), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
                    body: JSON.stringify({ registrationNumber: reg })
                });
                if (response.ok) {
                    const data = await response.json();
                    setMakeModel(`${data.make} ${data.colour}`);
                    setVehicleInfo(data);
                    alert("✅ Vehicle Found!");
                    success = true;
                }
            } catch (e) { console.log(`Proxy ${proxy} failed.`); }
        }

        if (!success) {
            alert("❌ All lookup attempts blocked by Government Firewall.\n\nPlease enter details manually.");
            setMakeModel("Manual Entry Required");
        }
        setIsLookingUp(false);
    };

    // --- Standard App Functions ---
    const handleRegChange = (e) => { setReg(e.target.value.toUpperCase()); setFoundHistory(false); };
    const checkHistory = async (r) => { const q = query(collection(db, 'estimates'), where("reg", "==", r), orderBy('createdAt', 'desc')); const s = await getDocs(q); if(!s.empty){ const p = s.docs[0].data(); setMakeModel(p.makeModel||''); setName(p.customer||''); setPhone(p.phone||''); setFoundHistory(true); } };
    const addToGoogleCalendar = () => { if(!bookingDate) return; const start = bookingDate.replace(/-/g, '') + 'T' + bookingTime.replace(/:/g, '') + '00'; window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=Repair:${reg}&dates=${start}/${start}`, '_blank'); };
    const handlePrint = () => { window.print(); };
    const uploadDoc = async (type, file) => { if(!currentJobId) return; const r = ref(storage, `deal_docs/${currentJobId}/${type}_${file.name}`); await uploadBytes(r, file); const u = await getDownloadURL(r); await updateDoc(doc(db, 'estimates', currentJobId), { [`dealFile.${type}`]: { name: file.name, url: u } }); alert("Uploaded"); };
    const saveSettings = async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Saved"); setMode('ESTIMATE'); };
    const addItem = () => { if (!itemDesc) return; const c = parseFloat(itemCostPrice)||0; setItems([...items, { desc: itemDesc, costPrice: c, price: c * (1 + (parseFloat(settings.markup)/100)) }]); setItemDesc(''); setItemCostPrice(''); };
    const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
    const calculateJobFinancials = () => { const pP = items.reduce((acc, i) => acc + i.price, 0); const pC = items.reduce((acc, i) => acc + i.costPrice, 0); const l = (parseFloat(laborHours)||0) * (parseFloat(laborRate)||0); const inv = pP + l; return { partsPrice: pP, partsCost: pC, labor: l, invoiceTotal: inv, totalJobCost: pC + (parseFloat(paintAllocated)||0), excessAmount: (parseFloat(excess)||0), finalDue: inv - (parseFloat(excess)||0) }; };
    const totals = calculateJobFinancials();
    const saveToCloud = async (t) => { if(!name||!reg) return alert("Missing Info"); setSaveStatus('SAVING'); let inv = invoiceNum; if(t.includes('INVOICE')&&!inv) inv = `INV-${Date.now().toString().slice(-4)}`; const docRef = await addDoc(collection(db, 'estimates'), { type: t, status: 'UNPAID', invoiceNumber: inv, customer: name, reg, items, laborHours, totals: calculateJobFinancials(), createdAt: serverTimestamp(), dealFile: { methodsRequired: false } }); setCurrentJobId(docRef.id); setSaveStatus('SUCCESS'); setTimeout(() => setSaveStatus('IDLE'), 2000); };
    const clearForm = () => { setReg(''); setName(''); setItems([]); setPhotos([]); setVehicleInfo(null); };

    // --- Signatures ---
    const startDrawing = ({nativeEvent}) => { const {offsetX, offsetY} = getCo(nativeEvent); const ctx = canvasRef.current.getContext('2d'); ctx.lineWidth=3; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(offsetX, offsetY); setIsDrawing(true); };
    const draw = ({nativeEvent}) => { if(!isDrawing) return; const {offsetX, offsetY} = getCo(nativeEvent); canvasRef.current.getContext('2d').lineTo(offsetX, offsetY); canvasRef.current.getContext('2d').stroke(); };
    const stopDrawing = () => { canvasRef.current.getContext('2d').closePath(); setIsDrawing(false); };
    const getCo = (e) => { if (e.touches && e.touches[0]) { const rect = canvasRef.current.getBoundingClientRect(); return { offsetX: e.touches[0].clientX - rect.left, offsetY: e.touches[0].clientY - rect.top }; } return { offsetX: e.offsetX, offsetY: e.offsetY }; };

    if(mode === 'SETTINGS') return <div style={{padding:'20px'}}><button onClick={()=>setMode('ESTIMATE')}>Back</button><h2>Settings</h2><input value={settings.laborRate} onChange={e=>setSettings({...settings, laborRate:e.target.value})} placeholder="Labor Rate"/><button onClick={saveSettings}>Save</button></div>;

    return (
        <div style={{padding:'20px', maxWidth:'800px', margin:'0 auto', fontFamily:'Arial'}}>
            <div style={{display:'flex', justifyContent:'space-between', borderBottom:'4px solid orange', paddingBottom:'10px'}}>
                <img src={process.env.PUBLIC_URL + "/1768838821897.png"} style={{maxHeight:'80px'}} onError={(e)=>e.target.style.display='none'}/>
                <div style={{textAlign:'right'}}>{settings.address}<br/>{settings.phone}</div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginTop:'20px'}}>
                <div>
                    <h4 style={headerStyle}>CLIENT</h4>
                    <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} style={inputStyle}/>
                    <input placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} style={inputStyle}/>
                </div>
                <div>
                    <h4 style={headerStyle}>VEHICLE</h4>
                    <div style={{display:'flex', gap:'5px'}}><input placeholder="REG" value={reg} onChange={handleRegChange} onBlur={()=>checkHistory(reg)} style={inputStyle}/><button onClick={lookupReg}>{isLookingUp ? '...' : '🔎'}</button></div>
                    {vehicleInfo && <div style={{fontSize:'0.8em', background:'#eee', padding:'5px'}}>{vehicleInfo.make} {vehicleInfo.colour}</div>}
                    <input placeholder="Make/Model" value={makeModel} onChange={e=>setMakeModel(e.target.value)} style={inputStyle}/>
                </div>
            </div>

            <div style={{marginTop:'20px'}}>
                <input placeholder="Item" value={itemDesc} onChange={e=>setItemDesc(e.target.value)} style={{width:'70%'}}/><input placeholder="£" value={itemCostPrice} onChange={e=>setItemCostPrice(e.target.value)} style={{width:'20%'}}/><button onClick={addItem}>+</button>
                <table style={{width:'100%', marginTop:'10px'}}>
                    {items.map((it, i) => <tr key={i}><td>{it.desc}</td><td style={{textAlign:'right'}}>£{it.price.toFixed(2)}</td><td><button onClick={()=>removeItem(i)}>x</button></td></tr>)}
                </table>
            </div>

            <div style={{position:'fixed', bottom:0, left:0, right:0, background:'white', padding:'10px', display:'flex', gap:'10px', borderTop:'1px solid #ddd', overflowX:'auto'}}>
                <button onClick={()=>saveToCloud('ESTIMATE')} style={greenBtn}>{saveStatus === 'SAVING' ? '...' : 'SAVE'}</button>
                <button onClick={()=>setMode('JOBCARD')} style={secondaryBtn}>Job Card</button>
                <button onClick={()=>setMode('DEAL_FILE')} style={secondaryBtn}>Deal File</button>
                <button onClick={handlePrint} style={secondaryBtn}>Print</button>
                <button onClick={()=>setMode('SETTINGS')} style={secondaryBtn}>⚙️</button>
            </div>
            <style>{`@media print {.no-print {display:none}}`}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => onAuthStateChanged(auth, (user) => user ? sU(user.uid) : signInAnonymously(auth)), []);
    if (!u) return <div>Loading...</div>;
    return <EstimateApp userId={u} />;
};

export default App;
