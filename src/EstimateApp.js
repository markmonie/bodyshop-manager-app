// BLOCK 1: SETUP
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import axios from 'axios';

const firebaseConfig = { apiKey: "AIzaSyDVfPvFLoL5eqQ3WQB96n08K3thdclYXRQ", authDomain: "triple-mmm-body-repairs.firebaseapp.com", projectId: "triple-mmm-body-repairs", storageBucket: "triple-mmm-body-repairs.firebasestorage.app", messagingSenderId: "110018101133", appId: "1:110018101133:web:63b0996c7050c4967147c4", measurementId: "G-NRDPCR0SR2" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

const inputStyle = { width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1em' };
const headerStyle = { borderBottom: '2px solid #cc0000', paddingBottom: '5px', marginBottom: '10px', color: '#cc0000', fontSize: '0.9em' };
const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '2px 0' };
const primaryBtn = { padding: '12px 24px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };
const successBtn = { padding: '12px 24px', background: '#15803d', color: 'white', border: '2px solid #22c55e', borderRadius: '6px', fontWeight: 'bold', cursor: 'default' };
const secondaryBtn = { padding: '12px 24px', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };
const stageBtn = { padding: '10px', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', background: 'white' };

const EstimateApp = ({ userId }) => {
    // STATE
    const [mode, setMode] = useState('ESTIMATE');
    const [invoiceNum, setInvoiceNum] = useState('');
    const [invoiceDate, setInvoiceDate] = useState('');
    const [invoiceType, setInvoiceType] = useState('MAIN');
    const [settings, setSettings] = useState({ laborRate: '50', markup: '20', companyName: 'TRIPLE MMM', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', email: 'markmonie72@gmail.com', dvlaKey: '', techs: 'Mark,Technician 1' });
    const [name, setName] = useState(''); const [address, setAddress] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState('');
    const [claimNum, setClaimNum] = useState(''); const [networkCode, setNetworkCode] = useState(''); const [insuranceCo, setInsuranceCo] = useState(''); const [insuranceAddr, setInsuranceAddr] = useState('');
    const [reg, setReg] = useState(''); const [mileage, setMileage] = useState(''); const [makeModel, setMakeModel] = useState(''); const [vin, setVin] = useState(''); const [paintCode, setPaintCode] = useState('');
    const [bookingDate, setBookingDate] = useState(''); const [bookingTime, setBookingTime] = useState('09:00'); const [foundHistory, setFoundHistory] = useState(false);
    const [itemDesc, setItemDesc] = useState(''); const [itemCostPrice, setItemCostPrice] = useState(''); const [items, setItems] = useState([]);
    const [photos, setPhotos] = useState([]); const [uploading, setUploading] = useState(false); const [paintAllocated, setPaintAllocated] = useState(''); 
    const [expDesc, setExpDesc] = useState(''); const [expAmount, setExpAmount] = useState(''); const [expCategory, setExpCategory] = useState('Stock');
    const [laborHours, setLaborHours] = useState(''); const [laborRate, setLaborRate] = useState('50'); const [vatRate, setVatRate] = useState('0'); const [excess, setExcess] = useState('');
    const [savedEstimates, setSavedEstimates] = useState([]); const [generalExpenses, setGeneralExpenses] = useState([]); const [saveStatus, setSaveStatus] = useState('IDLE');
    const [logoError, setLogoError] = useState(false); const [searchTerm, setSearchTerm] = useState('');
    const canvasRef = useRef(null); const [isDrawing, setIsDrawing] = useState(false);
    const [currentJobId, setCurrentJobId] = useState(null); const [methodsRequired, setMethodsRequired] = useState(false);
    const [activeTech, setActiveTech] = useState('Mark'); const [jobStages, setJobStages] = useState({}); const [jobNotes, setJobNotes] = useState([]); const [newNote, setNewNote] = useState('');

    const activeJob = useMemo(() => savedEstimates.find(j => j.id === currentJobId), [savedEstimates, currentJobId]);

    // EFFECTS
    useEffect(() => { getDoc(doc(db, 'settings', 'global')).then(s => { if(s.exists()) { setSettings(s.data()); setLaborRate(s.data().laborRate || '50'); setVatRate(s.data().vatRate || '0'); }});
        const u1 = onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), s => setSavedEstimates(s.docs.map(d => ({id: d.id, ...d.data()}))));
        const u2 = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), s => setGeneralExpenses(s.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => { u1(); u2(); }; }, []);

    useEffect(() => { const d = localStorage.getItem('t_draft'); if (d) { const p = JSON.parse(d); setName(p.n||''); setReg(p.r||''); setItems(p.i||[]); setLaborRate(p.l||settings.laborRate); setClaimNum(p.c||''); setPhotos(p.ph||[]); setBookingDate(p.bd||''); setVin(p.v||''); setExcess(p.ex||''); } }, [settings]);
    useEffect(() => { if(mode==='ESTIMATE') localStorage.setItem('t_draft', JSON.stringify({ n:name, r:reg, i:items, l:laborRate, c:claimNum, ph:photos, bd:bookingDate, v:vin, ex:excess })); }, [name, reg, items, laborRate, claimNum, photos, bookingDate, vin, excess, mode]);

// END BLOCK 1 - PASTE BLOCK 2 BELOW

// BLOCK 2: FUNCTIONS (Paste below Block 1)

    // --- WORKSHOP & NOTES ---
    const loadJobIntoState = (est) => { setCurrentJobId(est.id); setName(est.customer); setAddress(est.address||''); setPhone(est.phone||''); setEmail(est.email||''); setReg(est.reg); setMileage(est.mileage||''); setMakeModel(est.makeModel||''); setVin(est.vin||''); setPaintCode(est.paintCode||''); setClaimNum(est.claimNum||''); setNetworkCode(est.networkCode||''); setInsuranceCo(est.insuranceCo||''); setInsuranceAddr(est.insuranceAddr||''); setItems(est.items||[]); setLaborHours(est.laborHours||''); setLaborRate(est.laborRate||settings.laborRate); setVatRate(est.vatRate||settings.vatRate); setExcess(est.excess||''); setPhotos(est.photos||[]); setBookingDate(est.bookingDate||''); setBookingTime(est.bookingTime||'09:00'); setPaintAllocated(est.paintAllocated||''); setInvoiceNum(est.invoiceNumber||''); setMethodsRequired(est.dealFile?.methodsRequired||false); setJobStages(est.stages||{}); setJobNotes(est.notes||[]); setMode('DEAL_FILE'); window.scrollTo(0, 0); };
    
    // BLOCK 2 (CONTINUED) - PASTE BELOW loadJobIntoState

    const updateStage = async (k, c) => { 
        if (!currentJobId) return alert("Save first."); 
        let h=0; 
        if(c) { 
            const i = prompt("Hours?", "0"); 
            if(i===null) return; 
            h=parseFloat(i)||0; 
        } 
        const s = { ...jobStages, [k]: { completed: c, tech: c?activeTech:'', hours: h, date: c?new Date().toLocaleString():'' } }; 
        setJobStages(s); 
        await updateDoc(doc(db, 'estimates', currentJobId), { stages: s }); 
    };

    const addJobNote = async () => { 
        if (!newNote || !currentJobId) return; 
        const n = [...jobNotes, { text: newNote, tech: activeTech, date: new Date().toLocaleDateString(), resolved: false }]; 
        setJobNotes(n); 
        setNewNote(''); 
        await updateDoc(doc(db, 'estimates', currentJobId), { notes: n, hasFlag: true }); 
    };

    const resolveNote = async (i) => { 
        if (!currentJobId) return; 
        const n = [...jobNotes]; 
        n[i].resolved = !n[i].resolved; 
        setJobNotes(n); 
        await updateDoc(doc(db, 'estimates', currentJobId), { notes: n, hasFlag: n.some(x => !x.resolved) }); 
    };

    const uploadDoc = async (t, f) => { 
        if (!currentJobId || !f) return alert("Save first."); 
        const r = ref(storage, `docs/${currentJobId}/${t}_${f.name}`); 
        try { 
            setSaveStatus('SAVING'); 
            const s = await uploadBytes(r, f); 
            const u = await getDownloadURL(s.ref); 
            await updateDoc(doc(db, 'estimates', currentJobId), { [`dealFile.${t}`]: { name: f.name, url: u, date: new Date().toLocaleDateString() } }); 
            setSaveStatus('IDLE'); 
            alert("Uploaded!"); 
        } catch (e) { 
            alert(e.message); 
            setSaveStatus('IDLE'); 
        } 
    };

    const toggleMethods = async () => { 
        if (!currentJobId) return alert("Save first."); 
        setMethodsRequired(!methodsRequired); 
        await updateDoc(doc(db, 'estimates', currentJobId), { 'dealFile.methodsRequired': !methodsRequired }); 
    };
    
    // SAFE CALENDAR LINK (Split lines to prevent clipboard error)
    const addToGoogleCalendar = () => { 
        if(!bookingDate) return alert("Select Date."); 
        const s = bookingDate.replace(/-/g, '') + 'T' + bookingTime.replace(/:/g, '') + '00'; 
        const e = bookingDate.replace(/-/g, '') + 'T' + (parseInt(bookingTime.split(':')[0])+1).toString().padStart(2,'0') + bookingTime.split(':')[1] + '00'; 
        const t = encodeURIComponent(`Repair: ${name} (${reg})`);
        const d = encodeURIComponent(items.map(i=>i.desc).join('\n'));
        const l = encodeURIComponent(settings.address);
        window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${t}&dates=${s}/${e}&details=${d}&location=${l}`, '_blank'); 
    };

    const handlePrint = () => { if (['DEAL_FILE','DASHBOARD','SETTINGS','JOBCARD'].includes(mode)) setMode('INVOICE'); setTimeout(() => window.print(), 1000); };
    
    const checkHistory = async (r) => { 
        if(r.length<3) return; 
        const q = await getDocs(query(collection(db, 'estimates'), where("reg", "==", r), orderBy('createdAt', 'desc'))); 
        if (!q.empty) { 
            const p = q.docs[0].data(); 
            setMakeModel(p.makeModel||''); setName(p.customer||''); setPhone(p.phone||''); setEmail(p.email||''); 
            setAddress(p.address||''); setVin(p.vin||''); setPaintCode(p.paintCode||''); 
            if(p.insuranceCo) setInsuranceCo(p.insuranceCo); 
            setFoundHistory(true); 
        } 
    };

    const handleRegChange = (e) => { setReg(e.target.value.toUpperCase()); setFoundHistory(false); };
    
    const lookupReg = async () => { 
        if (!reg || reg.length < 3) return alert("Enter Reg"); 
        try { 
            const r = await axios.post('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles', { registrationNumber: reg }, { headers: { 'x-api-key': settings.dvlaKey } }); 
            if(r.data) setMakeModel(`${r.data.make} ${r.data.colour}`); 
        } catch (e) { 
            alert("Simulated: Found!"); setMakeModel("FORD TRANSIT (Simulated)"); 
        } 
    };

    const decodeVin = () => { if (!vin) return; const v = vin.toUpperCase().substring(0,3); window.open((v.startsWith('WBA')||v.startsWith('WMW'))?`https://www.mdecoder.com/decode/${vin}`:(v.startsWith('WDD')?`https://www.lastvin.com/vin/${vin}`:`https://7zap.com/en/search/?q=${vin}`), '_blank'); };
    const decodeParts = () => { if (!vin) return; const v = vin.toUpperCase().substring(0,3); window.open((v.startsWith('WBA')?`https://www.realoem.com/bmw/enUS/select?vin=${vin}`:`https://partsouq.com/en/catalog/genuine/locate?c=${vin}`), '_blank'); };
    const addItem = () => { if (!itemDesc) return; setItems([...items, { desc: itemDesc, costPrice: parseFloat(itemCostPrice)||0, price: (parseFloat(itemCostPrice)||0)*(1+(parseFloat(settings.markup)||0)/100) }]); setItemDesc(''); setItemCostPrice(''); };
    const removeItem = (i) => setItems(items.filter((_, x) => x !== i));
    const calculateJobFinancials = () => { const pp = items.reduce((a,i)=>a+i.price,0); const pc = items.reduce((a,i)=>a+i.costPrice,0); const l = (parseFloat(laborHours)||0)*(parseFloat(laborRate)||0); const inv = pp+l; const exc = parseFloat(excess)||0; return { partsPrice: pp, partsCost: pc, labor: l, paintCost: parseFloat(paintAllocated)||0, invoiceTotal: inv, totalJobCost: pc+(parseFloat(paintAllocated)||0), jobProfit: inv-(pc+(parseFloat(paintAllocated)||0)), excessAmount: exc, finalDue: inv-exc }; };
    const totals = calculateJobFinancials();
    const saveSettings = async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Saved!"); setMode('ESTIMATE'); };
    const addGeneralExpense = async () => { if(!expDesc) return; await addDoc(collection(db, 'expenses'), { desc: expDesc, amount: parseFloat(expAmount), category: expCategory, date: serverTimestamp() }); setExpDesc(''); setExpAmount(''); };
    const deleteJob = async (id) => { if(window.confirm("Delete?")) await deleteDoc(doc(db, 'estimates', id)); };
    const deleteExpense = async (id) => { if(window.confirm("Delete?")) await deleteDoc(doc(db, 'expenses', id)); };
    
    // SAFE EXPORTS (Split lines)
    const downloadAccountingCSV = () => { 
        let l = "data:text/csv;charset=utf-8,Date,Type,Invoice,Reg,Total\n";
        savedEstimates.filter(e=>e.type?.includes('INVOICE')).forEach(i=>{
            l += `${new Date(i.createdAt?.seconds*1000).toLocaleDateString()},${i.type},${i.invoiceNumber},${i.reg},${i.totals?.finalDue}\n`;
        });
        const a = document.createElement("a"); a.href = encodeURI(l); a.download = "Sales.csv"; a.click(); 
    };
    
    const downloadExpensesCSV = () => { 
        let l = "data:text/csv;charset=utf-8,Date,Cat,Desc,Amt\n";
        generalExpenses.forEach(e=>{
            l += `${new Date(e.date?.seconds*1000).toLocaleDateString()},${e.category},${e.desc},${e.amount}\n`;
        });
        const a = document.createElement("a"); a.href = encodeURI(l); a.download = "Expenses.csv"; a.click(); 
    };

    const togglePaid = async (id, s) => { await updateDoc(doc(db, 'estimates', id), { status: s==='PAID'?'UNPAID':'PAID' }); };
    const filteredEstimates = savedEstimates.filter(e => (e.customer+e.reg+e.invoiceNumber).toLowerCase().includes(searchTerm.toLowerCase()));
    const emailLink = `mailto:?subject=${encodeURIComponent(`Repair: ${reg}`)}&body=${encodeURIComponent(`Invoice: ${invoiceNum}\nAuth: Attached`)}`;
    const handlePhotoUpload = async (e) => { if (!e.target.files[0]) return; setUploading(true); const f = e.target.files[0]; const r = ref(storage, `photos/${Date.now()}_${f.name}`); try { await uploadBytes(r, f); const u = await getDownloadURL(r); setPhotos([...photos, u]); } catch (x) { alert("Fail"); } setUploading(false); };
    const removePhoto = (i) => setPhotos(photos.filter((_, x) => x !== i));
    
    const saveToCloud = async (t) => { 
        if (!name || !reg) return alert("Name/Reg missing"); setSaveStatus('SAVING'); 
        try { 
            let n = invoiceNum; let d = t; 
            if((t.includes('INVOICE')) && !n) { n = `INV-${1000+savedEstimates.length+1}`; setInvoiceNum(n); setInvoiceDate(new Date().toLocaleDateString()); } 
            if(t==='INVOICE_MAIN') { setMode('INVOICE'); setInvoiceType('MAIN'); d='INVOICE'; } else if (t==='INVOICE_EXCESS') { setMode('INVOICE'); setInvoiceType('EXCESS'); d='INVOICE (EXCESS)'; } else { setMode(t); } 
            const r = await addDoc(collection(db, 'estimates'), { type: d, status: 'UNPAID', invoiceNumber: n, customer: name, address, phone, email, claimNum, networkCode, insuranceCo, insuranceAddr, reg, mileage, makeModel, vin, paintCode, items, laborHours, laborRate, vatRate, excess, photos, bookingDate, bookingTime, totals: calculateJobFinancials(), createdAt: serverTimestamp(), createdBy: userId, dealFile: { methodsRequired: false }, stages: {}, notes: [], hasFlag: false }); 
            setCurrentJobId(r.id); setSaveStatus('SUCCESS'); setTimeout(()=>setSaveStatus('IDLE'),3000); 
        } catch (e) { alert(e.message); setSaveStatus('IDLE'); } 
    };

    const clearForm = () => { if(window.confirm("New Job?")) { setMode('ESTIMATE'); setInvoiceNum(''); setName(''); setReg(''); setItems([]); setPhotos([]); setCurrentJobId(null); setJobStages({}); setJobNotes([]); localStorage.removeItem('t_draft'); } };
    const startDrawing = ({nativeEvent}) => { const {offsetX, offsetY} = getCoordinates(nativeEvent); const c = canvasRef.current.getContext('2d'); c.lineWidth=3; c.strokeStyle='#000'; c.beginPath(); c.moveTo(offsetX, offsetY); setIsDrawing(true); };
    const draw = ({nativeEvent}) => { if(!isDrawing) return; const {offsetX, offsetY} = getCoordinates(nativeEvent); const c = canvasRef.current.getContext('2d'); c.lineTo(offsetX, offsetY); c.stroke(); };
    const stopDrawing = () => { canvasRef.current.getContext('2d').closePath(); setIsDrawing(false); };
    const getCoordinates = (e) => { if (e.touches && e.touches[0]) { const r = canvasRef.current.getBoundingClientRect(); return { offsetX: e.touches[0].clientX - r.left, offsetY: e.touches[0].clientY - r.top }; } return { offsetX: e.offsetX, offsetY: e.offsetY }; };
    const clearSignature = () => { if(canvasRef.current) canvasRef.current.getContext('2d').clearRect(0, 0, 350, 100); };
    useEffect(() => { clearSignature(); }, [mode]);
    const renderStage = (k, l) => { const s = jobStages[k]||{}; const d = s.completed; return ( <div style={{...stageBtn, borderColor: d?'#16a34a':'#ccc', background: d?'#f0fdf4':'white'}}> <div style={{display:'flex', gap:'10px'}}> <input type="checkbox" checked={d||false} onChange={(e)=>updateStage(k, e.target.checked)} /> <strong>{l}</strong> </div> {d && <div style={{fontSize:'0.8em'}}>👤 {s.tech} <br/> ⏱️ {s.hours}h</div>} </div> ); };

// END BLOCK 2 - PASTE BLOCK 3 BELOW






        // BLOCK 3: THE INTERFACE (Paste below Block 2)

    if(mode === 'SETTINGS') return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'Arial' }}>
            <button onClick={() => setMode('ESTIMATE')} className="no-print" style={{marginBottom:'20px', padding:'10px', background:'#eee', border:'none', borderRadius:'4px', cursor:'pointer'}}>← Back</button>
            <h2 style={{borderBottom:'2px solid #333', paddingBottom:'10px'}}>⚙️ Settings</h2>
            <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                <label>Labor Rate (£/hr): <input value={settings.laborRate} onChange={e => setSettings({...settings, laborRate: e.target.value})} style={inputStyle} /></label>
                <label>Parts Markup (%): <input value={settings.markup} onChange={e => setSettings({...settings, markup: e.target.value})} style={inputStyle} /></label>
                <label>Tech Names (Comma split): <input value={settings.techs} onChange={e => setSettings({...settings, techs: e.target.value})} style={inputStyle} /></label>
                <label>DVLA API Key: <input value={settings.dvlaKey} onChange={e => setSettings({...settings, dvlaKey: e.target.value})} style={inputStyle} placeholder="Paste key here later" /></label>
                <label>Address: <textarea value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} style={{...inputStyle, height:'60px'}} /></label>
                <button onClick={saveSettings} style={primaryBtn}>SAVE SETTINGS</button>
            </div>
        </div>
    );

    if(mode === 'DASHBOARD') {
        const totalSales = savedEstimates.filter(e => e.type && e.type.includes('INVOICE')).reduce((acc, curr) => acc + (curr.type.includes('EXCESS') ? parseFloat(curr.excess) : curr.totals?.finalDue || 0), 0);
        const netProfit = (savedEstimates.filter(e => e.type && e.type.includes('INVOICE')).reduce((acc, curr) => acc + (curr.totals?.jobProfit || 0), 0) - generalExpenses.reduce((acc, curr) => acc + curr.amount, 0));
        
        return (
            <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial' }}>
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
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px', marginBottom:'10px'}}>
                    <h3>Expense Log</h3>
                    <button onClick={downloadExpensesCSV} style={{background:'#4b5563', color:'white', border:'none', padding:'8px 15px', borderRadius:'4px', cursor:'pointer', fontSize:'0.9em'}}>📥 Export Expenses CSV</button>
                </div>
                {generalExpenses.map(ex => (<div key={ex.id} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', padding:'10px'}}><span>{ex.desc}</span><div style={{display:'flex', gap:'10px'}}><strong>£{ex.amount.toFixed(2)}</strong><button onClick={() => deleteExpense(ex.id)} style={{color:'red', border:'none', background:'none', cursor:'pointer'}}>x</button></div></div>))}
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial' }}>
            {mode !== 'ESTIMATE' && <button onClick={() => setMode('ESTIMATE')} className="no-print" style={{marginBottom:'10px', padding:'5px 10px'}}>← Back</button>}
            
            <div style={{borderBottom:'


    
