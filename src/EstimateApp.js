import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDVfPvFLoL5eqQ3WQB96n08K3thdclYXRQ",
  authDomain: "triple-mmm-body-repairs.firebaseapp.com",
  projectId: "triple-mmm-body-repairs",
  storageBucket: "triple-mmm-body-repairs.firebasestorage.app",
  messagingSenderId: "110018101133",
  appId: "1:110018101133:web:63b0996c7050c4967147c4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- THEME ---
const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', fin: '#8b5cf6', bg: '#000', card: '#111', text: '#f8fafc', border: '#333', danger: '#ef4444' };

// --- STYLES ---
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '32px', padding: '30px 20px', marginBottom: '35px', border: `2px solid ${theme.border}`, borderTop: `14px solid ${color || theme.hub}`, boxShadow: '0 40px 100px rgba(0,0,0,0.9)' }),
    input: { width: '100%', background: '#000', border: '3px solid #666', color: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', outline: 'none', fontSize: '20px', fontWeight: 'bold', boxSizing: 'border-box' },
    textarea: { width: '100%', background: '#000', border: '3px solid #666', color: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', outline: 'none', fontSize: '16px', fontWeight: 'bold', minHeight: '150px', boxSizing: 'border-box', fontFamily: 'Arial' },
    label: { color: '#94a3b8', fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '10px', display: 'block', letterSpacing: '2px' },
    displayBox: { background: '#050505', padding: '25px', borderRadius: '22px', border: '2px solid #222', marginBottom: '20px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '20px 30px', borderRadius: '20px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', transition: '0.1s', fontSize: '16px', flexShrink: 0, userSelect: 'none', touchAction: 'manipulation' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '20px', display: 'flex', gap: '15px', overflowX: 'auto', borderTop: '5px solid #222', zIndex: 1000 },
    loader: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, fontSize: '30px', flexDirection: 'column' }
};

// --- BUILD-CRITICAL COMPONENTS ---
const LoadingOverlay = () => (
    <div style={s.loader}>
        <div style={{border: '5px solid #333', borderTop: `5px solid ${theme.hub}`, borderRadius: '50%', width: '60px', height: '60px', animation: 'spin 1s linear infinite', marginBottom:'20px'}}></div>
        SYNCING...
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
);

const NativeSignature = ({ onSave }) => {
    const canvasRef = useRef(null); const [isDrawing, setIsDrawing] = useState(false);
    const getXY = (e) => { 
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect(); 
        let cX, cY; 
        if (e.changedTouches && e.changedTouches.length > 0) { cX = e.changedTouches[0].clientX; cY = e.changedTouches[0].clientY; } 
        else { cX = e.clientX; cY = e.clientY; } 
        return { x: cX - rect.left, y: cY - rect.top }; 
    };
    const start = (e) => { 
        const { x, y } = getXY(e); const ctx = canvasRef.current.getContext('2d'); 
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true); 
    };
    const move = (e) => { if (!isDrawing) return; const { x, y } = getXY(e); canvasRef.current.getContext('2d').lineTo(x, y); canvasRef.current.getContext('2d').stroke(); };
    const end = () => { setIsDrawing(false); onSave(canvasRef.current.toDataURL()); };
    return (
        <div style={{ background: '#fff', borderRadius: '25px', padding: '20px', marginBottom:'20px' }}>
            <canvas ref={canvasRef} width={400} height={200} onMouseDown={start} onMouseMove={move} onMouseUp={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} style={{ width: '100%', height: '200px', touchAction: 'none' }} />
            <button style={{ ...s.btnG('#222'), width: '100%', padding: '15px' }} onClick={() => { if(canvasRef.current) canvasRef.current.getContext('2d').clearRect(0,0,400,200); onSave(''); }}>CLEAR PAD</button>
        </div>
    );
};

// --- CORE APP LOGIC ---
const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    const [docType, setDocType] = useState('ESTIMATE'); 
    const [printMode, setPrintMode] = useState('FULL'); 
    const [history, setHistory] = useState([]);
    const [vaultSearch, setVaultSearch] = useState('');
    const [clientMatch, setClientMatch] = useState(null);
    
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: 'Sort Code: 80-22-60 | Acc: 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'lXqv1yDD1IatEPHlntk2w8MEuz9X57lE9TP9sxGc', logoUrl: '', paypalQr: '',
        terms: 'TERMS & CONDITIONS\n\n1. Payment due on completion.\n2. Vehicles left at owner risk.',
        invoiceCount: 1000 
    });

    const INITIAL_JOB = {
        status: 'STRIPPING', lastSuccess: '', invoiceNo: '', invoiceDate: '',
        client: { name: '', address: '', phone: '', email: '', claim: '' },
        insurance: { name: '', address: '', phone: '', email: '', claim: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', colour: '', fuel: '', engine: '', mot: '', motExpiry: '', mileage: '', fuelLevel: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0', techNotes: '' },
        vault: { signature: '', expenses: [] }
    };

    const [job, setJob] = useState(INITIAL_JOB);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const saved = localStorage.getItem('mmm_v720_PERFECT');
        if (saved) setJob(JSON.parse(saved));
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('mmm_v720_PERFECT', JSON.stringify(job)); }, [job]);

    // --- LOGIC ---
    const checkClientMatch = (name) => {
        if(!name || name.length < 3) { setClientMatch(null); return; }
        const match = history.find(h => h.client?.name?.toLowerCase().includes(name.toLowerCase()));
        if(match) setClientMatch(match.client); else setClientMatch(null);
    };
    const autofillClient = () => { if(clientMatch) { setJob(prev => ({...prev, client: {...prev.client, ...clientMatch}})); setClientMatch(null); } };
    const resetJob = () => { if(window.confirm("⚠️ START NEW JOB?")) { localStorage.removeItem('mmm_v720_PERFECT'); setJob(INITIAL_JOB); setClientMatch(null); window.scrollTo(0, 0); } };
    const loadJob = (savedJob) => { setJob(savedJob); setView('HUB'); window.scrollTo(0,0); };
    const deleteJob = async (id) => { if(window.confirm("Delete record?")) await deleteDoc(doc(db, 'estimates', id)); };

    const totals = useMemo(() => {
        const n = (v) => { let p = parseFloat(v); return isFinite(p) ? p : 0; };
        const itemsTotal = (job.repair.items || []).reduce((a, b) => a + (n(b.cost) * (1 + (n(settings.markup) / 100))), 0);
        const lHrs = n(job.repair.panelHrs) + n(job.repair.paintHrs) + n(job.repair.metHrs);
        const lPrice = lHrs * n(settings.labourRate);
        const subtotal = itemsTotal + lPrice + n(job.repair.paintMats);
        const total = subtotal * (1 + (n(settings.vatRate) / 100));
        return { total, insurer: (total - n(job.repair.excess)), lHrs, lPrice };
    }, [job.repair, settings]);

    // --- DVLA LOGIC ---
    const runDVLA = async () => {
        if (!job?.vehicle?.reg || !settings.dvlaKey) { alert("Need Reg & Key"); return; }
        setLoading(true); const cleanReg = job.vehicle.reg.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const proxies = ['https://corsproxy.io/?', 'https://thingproxy.freeboard.io/fetch/'];
        let success = false; let data = null;
        for (const proxy of proxies) { if(success) break; try { const res = await fetch(proxy + encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles'), { method: 'POST', headers: { 'x-api-key': settings.dvlaKey.trim(), 'Content-Type': 'application/json' }, body: JSON.stringify({ registrationNumber: cleanReg }) }); if (res.ok) { data = await res.json(); success = true; } } catch (e) {} }
        if (success && data) setJob(prev => ({ ...prev, vehicle: { ...prev.vehicle, make: data.make, year: data.yearOfManufacture, colour: data.colour, fuel: data.fuelType } }));
        else alert("Manual entry required."); setLoading(false);
    };

    // --- CSV LOGIC ---
    const downloadCSV = () => {
        const headers = ["Date", "Invoice #", "Reg", "Client", "Net (£)", "VAT (£)", "Total (£)", "Excess Paid (£)", "Expense Links"];
        const rows = history.map(h => {
            const tot = h.totals?.total || 0; const vatR = parseFloat(settings.vatRate || 20) / 100; const net = tot / (1 + vatR);
            return [new Date(h.createdAt?.seconds * 1000).toLocaleDateString(), h.invoiceNo || 'DRAFT', h.vehicle?.reg || 'N/A', h.client?.name || 'Unknown', net.toFixed(2), (tot - net).toFixed(2), tot.toFixed(2), (h.repair?.excess || 0), (h.vault?.expenses || []).join(" ; ")];
        });
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `MMM_Ledger_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`); document.body.appendChild(link); link.click();
    };

    const openDocument = async (type, mode = 'FULL') => {
        setDocType(type); setPrintMode(mode); let curInv = job.invoiceNo; const today = new Date().toLocaleDateString('en-GB');
        if (type === 'INVOICE' && !curInv) {
            const nextNum = (parseInt(settings.invoiceCount || 1000) + 1).toString();
            setJob(prev => ({ ...prev, invoiceNo: nextNum, invoiceDate: today }));
            setSettings(prev => ({ ...prev, invoiceCount: nextNum }));
            await setDoc(doc(db, 'settings', 'global'), { ...settings, invoiceCount: nextNum });
            await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, invoiceNo: nextNum, invoiceDate: today, totals }, { merge: true });
        }
        document.title = `${today.replace(/\//g, '-')}_${job.vehicle.reg || 'REG'}_${job.invoiceNo || 'DOC'}`;
        setView('PREVIEW'); window.scrollTo(0,0);
    };

    const saveMaster = async () => { setLoading(true); await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() }); setLoading(false); alert("SAVED."); };
    const handleFileUpload = async (e, path, field) => { const file = e.target.files[0]; if (!file) return; setLoading(true); try { const r = ref(storage, `${path}/${Date.now()}_${file.name}`); await uploadBytes(r, file); const url = await getDownloadURL(r); if (path === 'branding') setSettings(prev => ({...prev, [field]: url})); else setJob(prev => ({...prev, vault: {...prev.vault, expenses: [...(prev.vault.expenses || []), url]}})); } catch(err) { alert("Upload error"); } setLoading(false); };

    // --- VIEW: PREVIEW ---
    if (view === 'PREVIEW') {
        return (
            <div style={{background:'#fff', minHeight:'100vh', color:'#000', fontFamily:'Arial'}}>
                <div className="no-print" style={{position:'fixed', top:0, left:0, right:0, background:theme.deal, padding:'20px', zIndex:9999, display:'flex', gap:'10px'}}><button style={{...s.btnG('#333'), width:'100%', fontSize:'20px'}} onClick={() => { setView(docType === 'SATISFACTION NOTE' ? 'SAT' : 'EST'); document.title="Triple MMM"; }}>⬅️ BACK TO APP</button></div>
                <div style={{padding:'100px 40px 40px 40px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', borderBottom:'8px solid #f97316', paddingBottom:'20px', marginBottom:'20px'}}>
                        <div style={{flex:1}}>{settings.logoUrl && <img src={settings.logoUrl} style={{height:'80px', marginBottom:'10px'}} alt="Logo" />}{docType !== 'JOB CARD' && <h1 style={{margin:0, color:'#f97316', fontSize:'28px'}}>{settings.coName}</h1>}<p style={{fontSize:'12px'}}>{settings.address}<br/>{settings.phone}</p></div>
                        <div style={{textAlign:'right', flex:1}}><h2 style={{color:'#f97316', fontSize:'40px', margin:0}}>{docType === 'JOB CARD' ? 'JOB CARD' : printMode === 'EXCESS' ? 'INVOICE (EXCESS)' : docType}</h2><p style={{fontSize:'16px'}}><strong>Reg:</strong> {job.vehicle.reg}<br/><strong>Date:</strong> {job.invoiceDate || new Date().toLocaleDateString()}</p>{job.invoiceNo && docType === 'INVOICE' && <p style={{fontSize:'16px', color:'#f97316'}}><strong>Inv #: {job.invoiceNo}</strong></p>}<div style={{marginTop:'15px', fontSize:'12px', borderTop:'2px solid #ddd', paddingTop:'10px'}}><strong>TO:</strong> {printMode === 'INSURER' ? <>{job.insurance.name}<br/>Ref: {job.insurance.claim}</> : <>{job.client.name}<br/>{job.client.email}</>}</div></div>
                    </div>
                    {docType === 'SATISFACTION NOTE' ? (
                        <div style={{marginTop:'60px', textAlign: 'center'}}><h1 style={{color:'#f97316', fontSize:'48px', marginBottom:'40px'}}>SATISFACTION NOTE</h1><div style={{border:'4px solid #000', padding:'30px', borderRadius:'20px', marginBottom:'50px', background:'#f4f4f5', display: 'inline-block', textAlign: 'left', minWidth: '550px'}}><table style={{width:'100%', fontSize:'20px', fontWeight:'bold'}}><tbody><tr><td style={{padding:'12px'}}>REGISTRATION:</td><td style={{padding:'12px'}}>{job.vehicle.reg}</td></tr><tr><td style={{padding:'12px'}}>INVOICE #:</td><td style={{padding:'12px'}}>{job.invoiceNo || 'DRAFT'}</td></tr><tr><td style={{padding:'12px'}}>DATE:</td><td style={{padding:'12px'}}>{job.invoiceDate || new Date().toLocaleDateString()}</td></tr></tbody></table></div><p style={{fontSize:'26px', lineHeight:'1.6', maxWidth:'750px', margin:'0 auto 60px auto'}}>I, <strong>{job.client.name}</strong>, confirm repairs are completed to my satisfaction.</p><div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>{job.vault.signature ? <img src={job.vault.signature} style={{width:'350px', borderBottom:'3px solid #000'}} alt="Sig" /> : <div style={{width:'350px', height:'120px', borderBottom:'3px solid #000'}}></div>}<p style={{marginTop:'15px', fontSize:'20px', fontWeight:'900'}}>Signature</p></div></div>
                    ) : (
                        <div><table style={{width:'100%', borderCollapse:'collapse', fontSize:'12px'}}><thead><tr style={{background:'#eee'}}><th style={{padding:'8px', textAlign:'left'}}>Description</th><th style={{padding:'8px', textAlign:'right'}}>Amount</th></tr></thead><tbody>{(job.repair.items || []).map((it, i) => (<tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'8px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'8px'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>))}<tr><td style={{padding:'8px'}}>Labour ({totals.lHrs} hrs)</td><td style={{textAlign:'right', padding:'8px'}}>£{totals.lPrice.toFixed(2)}</td></tr><tr style={{borderTop:'2px solid #777'}}><td style={{padding:'8px', textAlign:'right'}}><strong>Total (Inc VAT):</strong></td><td style={{textAlign:'right', padding:'8px'}}><strong>£{totals.total.toFixed(2)}</strong></td></tr></tbody></table>{docType === 'JOB CARD' ? (<div style={{marginTop:'30px', border:'2px dashed #333', padding:'20px'}}><p>{job.repair.techNotes || 'No notes.'}</p></div>) : (<div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'30px'}}><div style={{flex:1, textAlign:'center', border:'4px solid #f97316', borderRadius:'20px', padding:'20px'}}><div style={{fontSize:'20px', fontWeight:'900'}}>BACS: {settings.bank}</div>{settings.paypalQr && <img src={settings.paypalQr} style={{height:'120px', marginTop:'10px'}} alt="QR" />}</div><div style={{flex:1, textAlign:'right'}}><h1 style={{fontSize:'45px', color:'#f97316'}}>£{printMode === 'EXCESS' ? parseFloat(job.repair.excess||0).toFixed(2) : printMode === 'INSURER' ? totals.insurer.toFixed(2) : totals.total.toFixed(2)}</h1></div></div>)}</div>
                    )}
                </div>
                <div className="no-print" style={{marginTop:'50px', borderTop:'2px solid #eee', paddingTop:'20px', paddingBottom:'80px', textAlign:'center', maxWidth:'600px', margin:'50px auto'}}><button style={{...s.btnG(theme.hub), width:'100%', fontSize:'26px', padding:'30px', border:'5px solid #fff'}} onClick={() => window.print()}>🖨️ OPEN PRINTER</button></div>
                <style>{`@media print { .no-print { display: none !important; } body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '180px' }}>
            {loading && <LoadingOverlay />}
            <div className="no-print">
                {view === 'HUB' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}><h1 style={{color:theme.hub, fontSize:'65px', textAlign:'center'}}>COMMAND HUB</h1><div style={s.card(theme.hub)}><div style={{display:'flex', gap:'12px', marginBottom:'20px'}}><input style={{...s.input, flex:4, fontSize:'55px', textAlign:'center'}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" /><button style={{...s.btnG(theme.hub), flex:1}} onClick={runDVLA}>FIND</button></div><div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}><input style={s.input} value={job.vehicle.make} onChange={e=>setJob({...job, vehicle:{...job.vehicle, make:e.target.value}})} placeholder="MAKE" /><input style={s.input} value={job.vehicle.year} onChange={e=>setJob({...job, vehicle:{...job.vehicle, year:e.target.value}})} placeholder="SPEC" /></div></div><div style={s.card(theme.deal)}><input style={s.input} placeholder="Client Name" value={job.client.name} onChange={e => { setJob({...job, client:{...job.client, name:e.target.value}}); checkClientMatch(e.target.value); }} />{clientMatch && ( <div style={{background:'#111', border:`1px solid ${theme.deal}`, padding:'10px', borderRadius:'10px', marginBottom:'15px', cursor:'pointer'}} onClick={autofillClient}><span style={{color:theme.deal, fontWeight:'bold'}}>✨ FOUND PREVIOUS CLIENT</span></div> )}<input style={s.input} placeholder="Full Address" value={job.client.address} onChange={e=>setJob({...job, client:{...job.client, address:e.target.value}})} /></div><button style={{...s.btnG(theme.deal), width:'100%', padding:'35px', fontSize:'32px'}} onClick={()=>setView('EST')}>ESTIMATOR</button><button style={{...s.btnG(theme.danger), width:'100%', marginTop:'20px'}} onClick={resetJob}>⚠️ START NEW JOB</button></div>
                )}
                {view === 'EST' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}><div style={{display:'flex', gap:'15px', marginBottom:'40px'}}><button style={{...s.btnG('#222'), flex:1}} onClick={() => setView('HUB')}>⬅️ BACK</button></div><div style={s.card(theme.work)}><div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'15px'}}><input style={s.input} value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} placeholder="MET" /><input style={s.input} value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} placeholder="PANEL" /><input style={s.input} value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} placeholder="PAINT" /></div>{job.repair.items.map((it, i) => (<div key={i} style={{display:'flex', gap:'10px', marginBottom:'15px'}}><input style={{...s.input, flex:3}} value={it.desc} placeholder="Part" onChange={(e) => { const n = [...job.repair.items]; n[i].desc = e.target.value; setJob({...job, repair:{...job.repair, items: n}}); }} /><input style={{...s.input, flex:1}} value={it.cost} placeholder="£" onChange={(e) => { const n = [...job.repair.items]; n[i].cost = e.target.value; setJob({...job, repair:{...job.repair, items: n}}); }} /><button onClick={() => { const n = job.repair.items.filter((_, idx) => idx !== i); setJob({...job, repair:{...job.repair, items: n}}); }} style={{...s.btnG(theme.danger), padding:'15px'}}>X</button></div>))}<button style={{...s.btnG(theme.work), width:'100%'}} onClick={() => setJob({...job, repair:{...job.repair, items: [...job.repair.items, { desc: '', cost: '' }]}})}>+ ADD ITEM</button></div><div style={s.card(theme.deal)}><h2 style={{fontSize:'45px', textAlign:'right'}}>£{totals.total.toFixed(2)}</h2><div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginTop:'10px'}}><button style={s.btnG('#333')} onClick={() => openDocument('INVOICE', 'FULL')}>FULL INV</button><button style={s.btnG(theme.deal)} onClick={() => openDocument('INVOICE', 'INSURER')}>INSURER</button><button style={s.btnG(theme.danger)} onClick={() => openDocument('INVOICE', 'EXCESS')}>EXCESS</button></div></div></div>
                )}
                {view === 'FIN' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}><div style={{display:'flex', gap:'15px', marginBottom:'40px'}}><button style={{...s.btnG('#222'), flex:1}} onClick={() => setView('HUB')}>⬅️ BACK</button></div><div style={s.card(theme.fin)}><div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'30px', marginBottom:'40px'}}><div style={s.displayBox}><span style={s.label}>REVENUE</span><div style={{fontSize:'40px'}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(0)}</div></div><div style={s.displayBox}><span style={s.label}>RECEIPTS</span><div style={{fontSize:'40px', color:theme.danger}}>{job.vault?.expenses?.length || 0}</div></div></div><button style={{...s.btnG(theme.fin), marginBottom:'30px'}} onClick={downloadCSV}>TAX LEDGER (CSV)</button><input type="file" onChange={(e) => handleFileUpload(e, 'finances', 'expenses')} style={{marginBottom:'20px'}} /><div style={{display:'flex', gap:'10px', overflowX:'auto'}}>{(job.vault?.expenses || []).map((url, i) => <img key={i} src={url} style={{height:'100px', border:'2px solid #333', borderRadius:'10px'}} alt="Receipt" />)}</div></div></div>
                )}
                {view === 'RECENT' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}><div style={{display:'flex', gap:'15px', marginBottom:'40px'}}><button style={{...s.btnG('#222'), flex:1}} onClick={() => setView('HUB')}>⬅️ BACK</button></div>{history.filter(h => JSON.stringify(h).toLowerCase().includes(vaultSearch.toLowerCase())).map((h) => (<div key={h.id} style={{...s.card('#333'), display:'flex', justifyContent:'space-between', alignItems:'center', padding:'25px'}}><div><h2 style={{margin:0, color:theme.hub}}>{h.vehicle?.reg}</h2><p style={{margin:0}}>{h.client?.name}</p></div><div style={{display:'flex', gap:'10px'}}><button style={s.btnG(theme.deal)} onClick={() => loadJob(h)}>OPEN</button><button style={s.btnG(theme.danger)} onClick={() => deleteJob(h.id)}>DEL</button></div></div>))}</div>
                )}
                {view === 'SET' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}><div style={{display:'flex', gap:'15px', marginBottom:'40px'}}><button style={{...s.btnG('#222'), flex:1}} onClick={() => setView('HUB')}>⬅️ BACK</button></div><div style={s.card(theme.set)}><input style={s.input} placeholder="Business Name" value={settings.coName} onChange={e=>setSettings({...settings, coName:e.target.value})} /><div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px'}}><div><span style={s.label}>Markup %</span><input style={s.input} value={settings.markup} onChange={e=>setSettings({...settings, markup:e.target.value})} /></div><div><span style={s.label}>Labour £/h</span><input style={s.input} value={settings.labourRate} onChange={e=>setSettings({...settings, labourRate:e.target.value})} /></div><div><span style={s.label}>VAT %</span><input style={s.input} value={settings.vatRate} onChange={e=>setSettings({...settings, vatRate:e.target.value})} /></div></div><span style={s.label}>Assets</span><div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}><button style={s.btnG('#222')} onClick={() => document.getElementById('logoIn').click()}>Logo</button><button style={s.btnG('#222')} onClick={() => document.getElementById('qrIn').click()}>QR</button><input id="logoIn" type="file" style={{display:'none'}} onChange={(e) => handleFileUpload(e, 'branding', 'logoUrl')} /><input id="qrIn" type="file" style={{display:'none'}} onChange={(e) => handleFileUpload(e, 'branding', 'paypalQr')} /></div><button style={{...s.btnG(theme.deal), width:'100%', marginTop:'20px'}} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Saved."); }}>SAVE SETTINGS</button></div></div>
                )}
                <div className="no-print" style={s.dock}><button onClick={()=>setView('HUB')} style={{...s.btnG(view==='HUB'?theme.hub:'#222'), minWidth:'100px'}}>HUB</button><button onClick={()=>setView('EST')} style={{...s.btnG(view==='EST'?theme.hub:'#222'), minWidth:'100px'}}>EST</button><button onClick={()=>setView('SAT')} style={{...s.btnG(view==='SAT'?theme.deal:'#222'), minWidth:'100px'}}>SAT</button><button onClick={()=>window.open('https://calendar.google.com/calendar/u/0/r?cid=markmonie72@gmail.com', '_blank')} style={{...s.btnG(theme.set), minWidth:'100px'}}>CAL</button><button onClick={()=>setView('FIN')} style={{...s.btnG(theme.fin), minWidth:'100px'}}>FIN</button><button onClick={()=>setView('RECENT')} style={{...s.btnG('#333'), minWidth:'100px'}}>JOBS</button><button onClick={()=>setView('SET')} style={{...s.btnG('#222'), minWidth:'100px'}}>SET</button><button style={{...s.btnG(theme.deal), minWidth:'180px'}} onClick={saveMaster}>SAVE</button></div>
            </div>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null); useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
