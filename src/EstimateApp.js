import React, { useState, useEffect, useRef } from 'react';
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

    // --- SETTINGS STATE ---
    const [settings, setSettings] = useState({
        laborRate: '50',
        vatRate: '0',
        companyName: 'TRIPLE MMM',
        address: '20A New Street, Stonehouse, ML9 3LT',
        phone: '07501 728319',
        email: 'markmonie72@gmail.com',
        dvlaKey: '' // NEW: Place to store your key later
    });

    // Inputs
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [claimNum, setClaimNum] = useState('');
    const [networkCode, setNetworkCode] = useState('');
    
    const [reg, setReg] = useState('');
    const [mileage, setMileage] = useState('');
    const [makeModel, setMakeModel] = useState('');

    // Items
    const [itemDesc, setItemDesc] = useState('');
    const [itemCost, setItemCost] = useState('');
    const [items, setItems] = useState([]);
    const [itemCostPrice, setItemCostPrice] = useState(''); 
    
    // Photos & Expenses
    const [photos, setPhotos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [expDesc, setExpDesc] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expCategory, setExpCategory] = useState('Stock');
    const [paintAllocated, setPaintAllocated] = useState(''); 

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
        }
    }, [settings]);

    useEffect(() => {
        if(mode === 'SETTINGS' || mode === 'DASHBOARD') return;
        const draft = { name, reg, items, laborRate, claimNum, networkCode, photos, paintAllocated };
        localStorage.setItem('triple_mmm_draft', JSON.stringify(draft));
    }, [name, reg, items, laborRate, claimNum, networkCode, photos, paintAllocated, mode]);

    // --- DVLA LOOKUP (Simulated until Key arrives) ---
    const lookupReg = async () => {
        if (!reg || reg.length < 3) return alert("Enter Registration");
        
        if (settings.dvlaKey) {
            // REAL LOOKUP (Future)
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
            // SIMULATED LOOKUP
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
    
    const deleteExpense = async (id) => { if(window.confirm("Delete?")) await deleteDoc(doc(db, 'expenses', id)); };

    const saveToCloud = async (type) => {
        if (!name || !reg) return alert("Enter Customer Name & Reg");
        setSaveStatus('SAVING');
        try {
            let finalInvNum = invoiceNum;
            if(type === 'INVOICE' && !finalInvNum) {
                finalInvNum = `INV-${1000 + savedEstimates.length + 1}`;
                setInvoiceNum(finalInvNum);
                setInvoiceDate(new Date().toLocaleDateString());
                setMode('INVOICE');
            }
            await addDoc(collection(db, 'estimates'), {
                type: type, status: 'UNPAID', invoiceNumber: finalInvNum,
                customer: name, address, phone, email, claimNum, networkCode,
                reg, mileage, makeModel, items, laborHours, laborRate, vatRate, excess, photos,
                totals: calculateJobFinancials(), createdAt: serverTimestamp(), createdBy: userId
            });
            setSaveStatus('SUCCESS'); setTimeout(() => setSaveStatus('IDLE'), 3000); 
        } catch (error) { alert("Error saving: " + error.message); setSaveStatus('IDLE'); }
    };

    const clearForm = () => {
        if(window.confirm("Start fresh?")) {
            setMode('ESTIMATE'); setInvoiceNum(''); setInvoiceDate(''); setName(''); setAddress(''); setPhone(''); setEmail('');
            setReg(''); setMileage(''); setMakeModel(''); setClaimNum(''); setNetworkCode(''); setItems([]); setLaborHours(''); setExcess(''); setPhotos([]); setPaintAllocated('');
            setSaveStatus('IDLE'); localStorage.removeItem('triple_mmm_draft'); 
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

    const startDrawing = ({nativeEvent}) => { const {offsetX, offsetY} = getCoordinates(nativeEvent); const ctx = canvasRef.current.getContext('2d'); ctx.lineWidth=3; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(offsetX, offsetY); setIsDrawing(true); };
    const draw = ({nativeEvent}) => { if(!isDrawing) return; const {offsetX, offsetY} = getCoordinates(nativeEvent); canvasRef.current.getContext('2d').lineTo(offsetX, offsetY); canvasRef.current.getContext('2d').stroke(); };
    const stopDrawing = () => { const ctx = canvasRef.current.getContext('2d'); ctx.closePath(); setIsDrawing(false); };
    const getCoordinates = (event) => { if (event.touches && event.touches[0]) { const rect = canvasRef.current.getBoundingClientRect(); return { offsetX: event.touches[0].clientX - rect.left, offsetY: event.touches[0].clientY - rect.top }; } return { offsetX: event.offsetX, offsetY: event.offsetY }; };
    const clearSignature = () => { if(canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); } };
    useEffect(() => { clearSignature(); }, [mode]);

    const downloadAccountingCSV = () => {
        const invoices = savedEstimates.filter(est => est.type === 'INVOICE');
        let csv = "data:text/csv;charset=utf-8,Date,Invoice,Customer,Total,Job Cost,Profit,Status\n";
        invoices.forEach(inv => {
            const d = inv.createdAt ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
            csv += `${d},${inv.invoiceNumber},${inv.customer},${inv.totals.invoiceTotal},${inv.totals.totalJobCost},${inv.totals.jobProfit},${inv.status}\n`;
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
        const totalSales = savedEstimates.filter(e => e.type === 'INVOICE').reduce((acc, curr) => acc + (curr.totals?.invoiceTotal || 0), 0);
        const totalJobCosts = savedEstimates.filter(e => e.type === 'INVOICE').reduce((acc, curr) => acc + (curr.totals?.totalJobCost || 0), 0);
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
                <h2 style={{ margin: 0, fontSize: '2em', color: '#333' }}>{mode === 'SATISFACTION' ? 'SATISFACTION NOTE' : (mode === 'JOBCARD' ? 'WORKSHOP JOB CARD' : mode)}</h2>
                {mode !== 'ESTIMATE' && mode !== 'JOBCARD' && <div style={{ textAlign: 'right' }}><div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{invoiceNum}</div><div>Date: {invoiceDate || new Date().toLocaleDateString()}</div></div>}
            </div>

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
                </div>
                <div>
                    <h4 style={headerStyle}>VEHICLE DETAILS</h4>
                    <div style={{display:'flex', gap:'10px'}}>
                        <input placeholder="Reg" value={reg} onChange={e => setReg(e.target.value)} style={{...inputStyle, fontWeight:'bold', textTransform:'uppercase', background:'#f0f9ff'}} />
                        
                        {/* LOOKUP BUTTON */}
                        <button onClick={lookupReg} className="no-print" style={{background:'#4b5563', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>🔎</button>
                        
                        <input placeholder="Mileage" value={mileage} onChange={e => setMileage(e.target.value)} style={inputStyle} />
                    </div>
                    <input placeholder="Make / Model" value={makeModel} onChange={e => setMakeModel(e.target.value)} style={inputStyle} />
                    
                    <div className="no-print" style={{marginTop:'10px', background:'#f0fdf4', padding:'10px', borderRadius:'4px', border:'1px dashed #16a34a'}}>
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                    </div>
                </div>
            </div>

            {photos.length > 0 && <div style={{marginBottom:'20px', display:'flex', gap:'10px', flexWrap:'wrap'}}>{photos.map((url, i) => (<div key={i} style={{position:'relative', width:'100px', height:'100px'}}><img src={url} alt="Damage" style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:'4px', border:'1px solid #ddd'}} /><button className="no-print" onClick={() => removePhoto(i)} style={{position:'absolute', top:-5, right:-5, background:'red', color:'white', borderRadius:'50%', width:'20px', height:'20px', cursor:'pointer'}}>×</button></div>))}</div>}

            {mode !== 'SATISFACTION' && (
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
                    {mode !== 'JOBCARD' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '300px', textAlign: 'right' }}>
                                <div className="no-print" style={{marginBottom:'10px'}}>Labor: <input type="number" value={laborHours} onChange={e => setLaborHours(e.target.value)} style={{width:'50px'}} /> hrs @ £<input type="number" value={laborRate} onChange={e => setLaborRate(e.target.value)} style={{width:'50px'}} /></div>
                                <div style={rowStyle}><span>Labor Total:</span> <span>£{totals.labor.toFixed(2)}</span></div>
                                <div style={rowStyle}><span>Parts Total:</span> <span>£{totals.partsPrice.toFixed(2)}</span></div>
                                <div style={{...rowStyle, fontSize:'1.2em', fontWeight:'bold', borderTop:'2px solid #333', marginTop:'5px'}}><span>GRAND TOTAL:</span> <span>£{totals.invoiceTotal.toFixed(2)}</span></div>
                                <div style={{...rowStyle, color:'#dc2626'}}><span>Less Excess:</span><span className="no-print"><input type="number" value={excess} onChange={e => setExcess(e.target.value)} style={{width:'60px'}} /></span><span>-£{totals.excessAmount.toFixed(2)}</span></div>
                                <div style={{...rowStyle, fontSize:'1.4em', fontWeight:'bold', color:'#333', borderTop:'2px solid #333', marginTop:'5px', paddingTop:'10px'}}><span>BALANCE DUE:</span> <span>£{totals.finalDue.toFixed(2)}</span></div>
                                <div className="no-print" style={{marginTop:'20px', padding:'10px', background:'#fef2f2', borderRadius:'4px', border:'1px dashed #f87171'}}>
                                    <h4 style={{margin:'0 0 5px 0', color:'#991b1b'}}>Internal Job Costs (Profit Check)</h4>
                                    <div style={rowStyle}><span>Allocated Materials:</span> <input type="number" value={paintAllocated} onChange={e => setPaintAllocated(e.target.value)} style={{width:'60px'}} /></div>
                                    <div style={rowStyle}><span>Parts Cost:</span> <span>£{totals.partsCost.toFixed(2)}</span></div>
                                    <div style={{...rowStyle, fontWeight:'bold', color: totals.jobProfit > 0 ? 'green' : 'red'}}><span>Job Profit:</span> <span>£{totals.jobProfit.toFixed(2)}</span></div>
                                </div>
                            </div>
                        </div>
                    )}
                    {(mode === 'INVOICE' || mode === 'JOBCARD') && (
                        <div style={{ marginTop: '50px', padding: '20px', background: '#f9f9f9', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', border: '1px solid #ddd' }}>
                            {mode === 'INVOICE' && <div><h4 style={{margin:'0 0 10px 0'}}>PAYMENT DETAILS</h4><div style={{fontSize:'0.9em', lineHeight:'1.6'}}>Account Name: <strong>{settings.companyName} BODY REPAIRS</strong><br/>Account No: <strong>06163462</strong><br/>Sort Code: <strong>80-22-60</strong><br/>Bank: <strong>BANK OF SCOTLAND</strong></div></div>}
                            {mode === 'JOBCARD' && <div><strong>Technician Notes:</strong><br/><br/>_______________________</div>}
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
                    <p style={{ lineHeight: '1.8', fontSize: '1.1em' }}>I/We authorize payment to be made directly to the repairer in respect of the invoice number <strong>{invoiceNum}</strong> relative to this claim.</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '80px', gap: '20px' }}>
                        <div style={{ width: '45%' }}><div className="no-print" style={{border: '1px dashed #ccc', height: '100px', backgroundColor: '#fff', position: 'relative', marginBottom:'5px'}}><canvas ref={canvasRef} width={350} height={100} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={{width: '100%', height: '100%', touchAction: 'none'}} /><button onClick={clearSignature} style={{position: 'absolute', top: 5, right: 5, fontSize: '0.7em', padding: '2px 5px'}}>Clear</button></div><div style={{ borderBottom: '1px solid #333', marginBottom: '10px' }}></div><strong>Customer Signature</strong></div>
                        <div style={{ width: '45%' }}><div style={{ borderBottom: '1px solid #333', height: '100px', marginBottom: '10px', display:'flex', alignItems:'flex-end' }}><span>{new Date().toLocaleDateString()}</span></div><strong>Date</strong></div>
                    </div>
                </div>
            )}

            <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px', background: 'white', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'center', gap: '15px', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', flexWrap: 'wrap' }}>
                <button onClick={() => saveToCloud('ESTIMATE')} disabled={saveStatus === 'SAVING'} style={saveStatus === 'SUCCESS' ? successBtn : primaryBtn}>{saveStatus === 'SAVING' ? 'SAVING...' : (saveStatus === 'SUCCESS' ? '✅ SAVED!' : 'SAVE ESTIMATE')}</button>
                {mode === 'ESTIMATE' && <button onClick={() => saveToCloud('INVOICE')} style={secondaryBtn}>GENERATE INVOICE</button>}
                <button onClick={() => setMode('JOBCARD')} style={{...secondaryBtn, background: '#4b5563'}}>JOB CARD</button>
                {mode === 'INVOICE' && <button onClick={() => setMode('SATISFACTION')} style={{...secondaryBtn, background: '#d97706'}}>SATISFACTION NOTE</button>}
                <button onClick={() => window.print()} style={{...secondaryBtn, background: '#333'}}>PRINT</button>
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
                {filteredEstimates.map(est => (<div key={est.id} style={{padding:'10px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center', backgroundColor: est.status === 'PAID' ? '#f0fdf4' : 'transparent'}}><div style={{color: est.type === 'INVOICE' ? '#16a34a' : '#333'}}><span>{est.type === 'INVOICE' ? `📄 ${est.invoiceNumber}` : '📝 Estimate'} - {est.customer} ({est.reg})</span><div style={{fontSize:'0.8em', color:'#666'}}>{new Date(est.createdAt?.seconds * 1000).toLocaleDateString()} - £{est.totals?.finalDue.toFixed(2)}</div></div><button onClick={() => togglePaid(est.id, est.status)} style={{padding:'5px 10px', border:'1px solid #ccc', borderRadius:'4px', background: est.status === 'PAID' ? '#16a34a' : 'white', color: est.status === 'PAID' ? 'white' : '#333', cursor:'pointer'}}>{est.status === 'PAID' ? 'PAID' : 'MARK PAID'}</button></div>))}
            </div>

            <style>{`@media print { .no-print { display: none !important; } body { padding: 0; margin: 0; } }`}</style>
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
