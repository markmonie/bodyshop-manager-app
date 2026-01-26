import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ==========================================
// 🔑 DVLA API KEY (Hardcoded from 2:22 PM Yesterday)
// ==========================================
const HARDCODED_DVLA_KEY = "IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc"; 

// --- INTERNAL AXIOS ENGINE (The Working Logic) ---
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

// --- STYLES ---
const theme = {
    primary: '#ea580c', green: '#16a34a', red: '#dc2626', light: '#fff7ed', dark: '#9a3412',
    border: '#fdba74', grey: '#f8fafc', text: '#334155', disabled: '#9ca3af'
};
const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1em', boxSizing: 'border-box' };
const headerStyle = { borderBottom: `2px solid ${theme.primary}`, paddingBottom: '5px', marginBottom: '15px', color: theme.primary, fontSize: '0.9em', fontWeight: 'bold', letterSpacing: '1px' };
const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '4px 0' };
const primaryBtn = { padding: '12px 20px', border: 'none', borderRadius: '50px', background: theme.primary, color: 'white', fontWeight: 'bold', cursor: 'pointer' };
const greenBtn = { ...primaryBtn, background: theme.green };
const secondaryBtn = { ...primaryBtn, background: '#334155' };

const EstimateApp = ({ userId }) => {
    const [mode, setMode] = useState('ESTIMATE');
    const [invoiceNum, setInvoiceNum] = useState('');
    const [settings, setSettings] = useState({ laborRate: '50', markup: '20', companyName: 'TRIPLE MMM', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', email: 'markmonie72@gmail.com' });
    
    const [name, setName] = useState(''); const [phone, setPhone] = useState('');
    const [reg, setReg] = useState(''); const [makeModel, setMakeModel] = useState('');
    const [vin, setVin] = useState(''); const [paintCode, setPaintCode] = useState('');
    const [vehicleInfo, setVehicleInfo] = useState(null); const [isLookingUp, setIsLookingUp] = useState(false);
    
    const [items, setItems] = useState([]); const [itemDesc, setItemDesc] = useState(''); const [itemCostPrice, setItemCostPrice] = useState('');
    const [laborHours, setLaborHours] = useState(''); const [excess, setExcess] = useState(''); const [paintAllocated, setPaintAllocated] = useState('');
    
    const [savedEstimates, setSavedEstimates] = useState([]); const [saveStatus, setSaveStatus] = useState('IDLE');
    const canvasRef = useRef(null); const [isDrawing, setIsDrawing] = useState(false); const [currentJobId, setCurrentJobId] = useState(null);

    useEffect(() => {
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setSavedEstimates(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    }, []);

    // --- WORKING DVLA LOOKUP (2:22 PM Logic) ---
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
            alert("⚠️ DVLA Blocked the connection. Please type details manually.");
            setMakeModel("Manual Entry Required");
        } finally { setIsLookingUp(false); }
    };

    // --- APP FUNCTIONS ---
    const handlePrint = () => { window.print(); };
    const addItem = () => { if (!itemDesc) return; const c = parseFloat(itemCostPrice)||0; setItems([...items, { desc: itemDesc, costPrice: c, price: c * (1 + (parseFloat(settings.markup)/100)) }]); setItemDesc(''); setItemCostPrice(''); };
    const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
    const calculateTotals = () => {
        const pP = items.reduce((acc, i) => acc + i.price, 0); 
        const l = (parseFloat(laborHours)||0) * (parseFloat(settings.laborRate)||0);
        return { invoiceTotal: pP + l, finalDue: (pP + l) - (parseFloat(excess)||0) };
    };
    const totals = calculateTotals();

    const saveToCloud = async (t) => {
        if(!name||!reg) return alert("Enter Name & Reg");
        setSaveStatus('SAVING');
        const docRef = await addDoc(collection(db, 'estimates'), { 
            customer: name, reg, totals: calculateTotals(), createdAt: serverTimestamp(), type: t 
        });
        setCurrentJobId(docRef.id); setSaveStatus('SUCCESS'); setTimeout(() => setSaveStatus('IDLE'), 2000);
    };

    return (
        <div style={{padding:'20px', maxWidth:'800px', margin:'0 auto', fontFamily:'Arial'}}>
            <div style={{display:'flex', justifyContent:'space-between', borderBottom:'4px solid orange', paddingBottom:'10px', marginBottom:'20px'}}>
                <div style={{fontSize:'1.5em', fontWeight:'bold', color:theme.primary}}>TRIPLE MMM REPAIRS</div>
                <div style={{textAlign:'right', fontSize:'0.8em'}}>{settings.address}<br/>{settings.phone}</div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                <div>
                    <h4 style={headerStyle}>CLIENT</h4>
                    <input placeholder="Customer Name" value={name} onChange={e=>setName(e.target.value)} style={inputStyle}/>
                    <input placeholder="Phone Number" value={phone} onChange={e=>setPhone(e.target.value)} style={inputStyle}/>
                </div>
                <div>
                    <h4 style={headerStyle}>VEHICLE</h4>
                    <div style={{display:'flex', gap:'5px'}}>
                        <input placeholder="REG" value={reg} onChange={e=>setReg(e.target.value.toUpperCase())} style={inputStyle}/>
                        <button onClick={lookupReg} style={{height:'40px', background:theme.primary, color:'white', border:'none', borderRadius:'6px', padding:'0 15px'}}>{isLookingUp ? '...' : '🔎'}</button>
                    </div>
                    {vehicleInfo && <div style={{fontSize:'0.8em', background:'#eee', padding:'10px', borderRadius:'6px', marginBottom:'10px', border:'1px dashed orange'}}><strong>{vehicleInfo.make} {vehicleInfo.colour}</strong><br/>Year: {vehicleInfo.yearOfManufacture}</div>}
                    <input placeholder="Make/Model" value={makeModel} onChange={e=>setMakeModel(e.target.value)} style={inputStyle}/>
                    <input placeholder="VIN" value={vin} onChange={e=>setVin(e.target.value)} style={inputStyle}/>
                </div>
            </div>

            <div style={{marginTop:'30px'}}>
                <div style={{display:'flex', gap:'10px', marginBottom:'15px'}} className="no-print">
                    <input placeholder="Item" value={itemDesc} onChange={e=>setItemDesc(e.target.value)} style={{flex:1, ...inputStyle}}/>
                    <input placeholder="£ Cost" type="number" value={itemCostPrice} onChange={e=>setItemCostPrice(e.target.value)} style={{width:'100px', ...inputStyle}}/>
                    <button onClick={addItem} style={greenBtn}>+</button>
                </div>
                <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead><tr style={{textAlign:'left', borderBottom:'2px solid black'}}><th>Description</th><th style={{textAlign:'right'}}>Price</th></tr></thead>
                    <tbody>{items.map((it, i) => (<tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'10px 0'}}>{it.desc}</td><td style={{textAlign:'right'}}>£{it.price.toFixed(2)}</td><td className="no-print"><button onClick={()=>removeItem(i)} style={{color:'red', border:'none', background:'none'}}>x</button></td></tr>))}</tbody>
                </table>
            </div>

            <div style={{display:'flex', justifyContent:'flex-end', marginTop:'30px'}}>
                <div style={{width:'300px', textAlign:'right'}}>
                    <div className="no-print">Labor: <input type="number" value={laborHours} onChange={e=>setLaborHours(e.target.value)} style={{width:'60px'}}/> hrs</div>
                    <div style={rowStyle}><span>Subtotal:</span><strong>£{totals.invoiceTotal.toFixed(2)}</strong></div>
                    <div style={rowStyle}><span>Excess:</span><input type="number" value={excess} onChange={e=>setExcess(e.target.value)} style={{width:'60px'}}/></div>
                    <div style={{...rowStyle, fontSize:'1.4em', background:'#eee', padding:'10px', borderRadius:'6px', marginTop:'10px'}}><span>DUE:</span><strong>£{totals.finalDue.toFixed(2)}</strong></div>
                </div>
            </div>

            <div className="no-print" style={{position:'fixed', bottom:0, left:0, right:0, background:'white', padding:'15px', display:'flex', gap:'10px', borderTop:'1px solid #ddd', overflowX:'auto', zIndex:1000}}>
                <button onClick={()=>saveToCloud('ESTIMATE')} style={saveStatus==='SUCCESS'?greenBtn:primaryBtn}>{saveStatus==='SAVING'?'...':'SAVE'}</button>
                <button onClick={handlePrint} style={secondaryBtn}>Print</button>
                <button onClick={()=>window.location.reload()} style={{...secondaryBtn, background:theme.red}}>New</button>
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
