import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- CONFIGURATION ---
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
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '20px', display: 'flex', gap: '15px', overflowX: 'auto', flexWrap: 'nowrap', borderTop: '5px solid #222', zIndex: 1000, paddingRight: '150px' },
    loader: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, fontSize: '30px', flexDirection: 'column' }
};

// --- TOP-LEVEL UI COMPONENTS ---
const LoadingOverlay = () => (
    <div style={s.loader}>
        <div style={{border: '5px solid #333', borderTop: `5px solid ${theme.hub}`, borderRadius: '50%', width: '60px', height: '60px', animation: 'spin 1s linear infinite', marginBottom:'20px'}}></div>
        PROCESSING...
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
);

const NativeSignature = ({ onSave }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const getXY = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        let cX, cY;
        if (e.changedTouches && e.changedTouches.length > 0) { cX = e.changedTouches[0].clientX; cY = e.changedTouches[0].clientY; } 
        else { cX = e.clientX; cY = e.clientY; }
        return { x: cX - rect.left, y: cY - rect.top };
    };
    const start = (e) => {
        const { x, y } = getXY(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(x, y);
        setIsDrawing(true);
    };
    const move = (e) => { if (!isDrawing) return; const { x, y } = getXY(e); canvasRef.current.getContext('2d').lineTo(x, y); canvasRef.current.getContext('2d').stroke(); };
    const end = () => { setIsDrawing(false); onSave(canvasRef.current.toDataURL()); };
    return (
        <div style={{ background: '#fff', borderRadius: '25px', padding: '20px', marginBottom:'20px' }}>
            <canvas ref={canvasRef} width={400} height={200} onMouseDown={start} onMouseMove={move} onMouseUp={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} style={{ width: '100%', height: '200px', touchAction: 'none' }} />
            <button style={{ ...s.btnG('#222'), width: '100%', padding: '15px' }} onClick={() => { canvasRef.current.getContext('2d').clearRect(0,0,400,200); onSave(''); }}>CLEAR PAD</button>
        </div>
    );
};

// --- MAIN APPLICATION CORE ---
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
        const saved = localStorage.getItem('mmm_v620_FINAL');
        if (saved) setJob(JSON.parse(saved));
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('mmm_v620_FINAL', JSON.stringify(job)); }, [job]);

    // --- LOGIC FUNCTIONS ---
    const checkClientMatch = (name) => {
        if(!name || name.length < 3) { setClientMatch(null); return; }
        const match = history.find(h => h.client?.name?.toLowerCase().includes(name.toLowerCase()));
        if(match) setClientMatch(match.client); else setClientMatch(null);
    };
    const autofillClient = () => { if(clientMatch) { setJob(prev => ({...prev, client: {...prev.client, ...clientMatch}})); setClientMatch(null); } };

    const resetJob = () => {
        if(window.confirm("⚠️ Clear current data?")) {
            localStorage.removeItem('mmm_v620_FINAL');
            setJob(INITIAL_JOB);
            setClientMatch(null); 
            window.scrollTo(0, 0); 
        }
    };

    const loadJob = (savedJob) => { setJob(savedJob); setView('HUB'); window.scrollTo(0,0); };
    const deleteJob = async (id) => { if(window.confirm("Delete record?")) await deleteDoc(doc(db, 'estimates', id)); };

    const totals = useMemo(() => {
        const n = (v) => { let p = parseFloat(v); return isFinite(p) ? p : 0; };
        const pCost = (job.repair.items || []).reduce((a, b) => a + n(b.cost), 0);
        const pPrice = pCost * (1 + (n(settings.markup) / 100));
        const lHrs = n(job.repair.panelHrs) + n(job.repair.paintHrs) + n(job.repair.metHrs);
        const lPrice = lHrs * n(settings.labourRate);
        const subtotal = pPrice + lPrice + n(job.repair.paintMats);
        const total = subtotal * (1 + (n(settings.vatRate) / 100));
        return { total, insurer: (total - n(job.repair.excess)), lHrs, lPrice };
    }, [job.repair, settings]);

    const projectedDate = useMemo(() => {
        const hrs = parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0);
        if (hrs <= 0) return "N/A";
        let daysNeeded = Math.ceil(hrs / 8); let date = new Date(); let count = 0;
        while(count < daysNeeded) { date.setDate(date.getDate() + 1); if(date.getDay() !== 0 && date.getDay() !== 6) count++; }
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }, [job.repair]);

    const runDVLA = async () => {
        if (!job?.vehicle?.reg || !settings.dvlaKey) { alert("Check Reg & API Key"); return; }
        setLoading(true);
        const cleanReg = job.vehicle.reg.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const proxies = ['https://corsproxy.io/?', 'https://thingproxy.freeboard.io/fetch/'];
        const targetUrl = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
        let success = false; let data = null;
        for (const proxy of proxies) {
            if(success) break;
            try {
                const response = await fetch(proxy + encodeURIComponent(targetUrl), {
                    method: 'POST',
                    headers: { 'x-api-key': settings.dvlaKey.trim(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ registrationNumber: cleanReg })
                });
                if (response.ok) { data = await response.json(); success = true; }
            } catch (e) { console.warn(`Proxy fail`); }
        }
        if (success && data) {
            setJob(prev => ({
                ...prev, lastSuccess: new Date().toLocaleString('en-GB'),
                vehicle: { ...prev.vehicle, make: data.make, year: data.yearOfManufacture, colour: data.colour, fuel: data.fuelType, engine: data.engineCapacity, mot: data.motStatus, motExpiry: data.motExpiryDate }
            }));
        } else { alert("Lookup failed. Enter manually."); }
        setLoading(false);
    };

    const downloadCSV = () => {
        const headers = ["Date", "Invoice #", "Reg", "Client", "Total (£)", "Excess (£)", "Status"];
        const rows = history.map(h => [
            new Date(h.createdAt?.seconds * 1000).toLocaleDateString(), h.invoiceNo || '-', h.vehicle.reg, h.client.name,
            (h.totals?.total || 0).toFixed(2), (h.repair?.excess || 0), h.status
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `Tax_Ledger_${new Date().toLocaleDateString()}.csv`); document.body.appendChild(link); link.click();
    };

    const openDocument = async (type, mode = 'FULL') => {
        setDocType(type);
        setPrintMode(mode);
        let currentInvoiceNo = job.invoiceNo;
        const today = new Date().toLocaleDateString('en-GB');
        if (type === 'INVOICE' && !currentInvoiceNo) {
            const nextNum = parseInt(settings.invoiceCount || 1000) + 1;
            currentInvoiceNo = nextNum.toString();
            setJob(prev => ({ ...prev, invoiceNo: currentInvoiceNo, invoiceDate: today }));
            setSettings(prev => ({ ...prev, invoiceCount: nextNum }));
            await setDoc(doc(db, 'settings', 'global'), { ...settings, invoiceCount: nextNum });
            await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, invoiceNo: currentInvoiceNo, invoiceDate: today, totals }, { merge: true });
        }
        const safeDate = (today).replace(/\//g, '-');
        document.title = `${safeDate}_${job.vehicle.reg || 'REG'}_${currentInvoiceNo || 'DOC'}`;
        setView('PREVIEW');
        window.scrollTo(0,0);
    };

    const saveMaster = async () => {
        setLoading(true);
        await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
        setLoading(false);
        alert("Saved.");
    };

    const handleFileUpload = async (e, path, field) => {
        const file = e.target.files[0]; if (!file) return;
        setLoading(true);
        const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if (path === 'branding') setSettings(prev => ({...prev, [field]: url}));
        else setJob(prev => ({...prev, vault: {...prev.vault, expenses: [...(prev.vault.expenses || []), url]}}));
        setLoading(false);
    };

    if (view === 'PREVIEW') {
        return (
            <div style={{background:'#fff', minHeight:'100vh', color:'#000', fontFamily:'Arial'}}>
                <div className="no-print" style={{position:'fixed', top:0, left:0, right:0, background:theme.deal, padding:'20px', zIndex:9999, display:'flex', gap:'10px', boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
                    <button style={{...s.btnG('#333'), width:'100%', fontSize:'20px', fontWeight:'900'}} onClick={() => { setView(docType === 'SATISFACTION NOTE' ? 'SAT' : 'EST'); document.title="Triple MMM"; }}>⬅️ BACK TO HUB</button>
                </div>
                <div style={{padding:'100px 40px 40px 40px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', borderBottom:'8px solid #f97316', paddingBottom:'20px', marginBottom:'20px'}}>
                        <div style={{flex:1}}>
                            {settings.logoUrl && <img src={settings.logoUrl} style={{height:'80px', marginBottom:'10px'}} alt="Logo" />}
                            {docType !== 'JOB CARD' && <h1 style={{margin:0, color:'#f97316', fontSize:'28px'}}>{settings.coName}</h1>}
                            <p style={{fontSize:'12px', lineHeight:'1.4'}}>{settings.address}<br/>{settings.phone}</p>
                        </div>
                        <div style={{textAlign:'right', flex:1}}>
                            <h2 style={{color:'#f97316', fontSize:'40px', margin:0}}>{docType === 'JOB CARD' ? 'WORKSHOP JOB CARD' : printMode === 'EXCESS' ? 'INVOICE (EXCESS)' : docType}</h2>
                            <p style={{fontSize:'16px'}}><strong>Reg:</strong> {job.vehicle.reg}<br/><strong>Date:</strong> {job.invoiceDate || new Date().toLocaleDateString()}</p>
                            {job.invoiceNo && docType === 'INVOICE' && <p style={{fontSize:'16px', color:'#f97316'}}><strong>Inv #: {job.invoiceNo}</strong></p>}
                            {docType === 'JOB CARD' && <div style={{marginTop:'10px', fontSize:'14px', fontWeight:'bold', border:'1px solid black', padding:'5px'}}>Mileage: {job.vehicle.mileage || '_______'} | Fuel: {job.vehicle.fuelLevel || '_______'}</div>}
                            <div style={{marginTop:'15px', fontSize:'12px', borderTop:'2px solid #ddd', paddingTop:'10px'}}>
                                <strong>BILL TO:</strong><br/>
                                {printMode === 'INSURER' ? <>{job.insurance.name}<br/>{job.insurance.address}<br/>Ref: {job.insurance.claim}</> : <>{job.client.name}<br/>{job.client.address}<br/>{job.client.email}</>}
                            </div>
                        </div>
                    </div>
                    {docType === 'SATISFACTION NOTE' ? (
                        <div style={{marginTop:'40px', textAlign: 'center'}}>
                            <h1 style={{color:'#f97316', fontSize:'40px', marginBottom:'30px'}}>SATISFACTION NOTE</h1>
                            <div style={{border:'2px solid #333', padding:'20px', borderRadius:'15px', marginBottom:'40px', background:'#f9f9f9', display: 'inline-block', textAlign: 'left', minWidth: '500px'}}>
                                <table style={{width:'100%', fontSize:'18px', fontWeight:'bold'}}>
                                    <tbody>
                                        <tr><td style={{padding:'8px', textAlign:'right', color:'#666', width:'40%'}}>VEHICLE:</td><td style={{padding:'8px'}}>{job.vehicle.make} {job.vehicle.year}</td></tr>
                                        <tr><td style={{padding:'8px', textAlign:'right', color:'#666'}}>REGISTRATION:</td><td style={{padding:'8px'}}>{job.vehicle.reg}</td></tr>
                                        <tr><td style={{padding:'8px', textAlign:'right', color:'#666'}}>INVOICE #:</td><td style={{padding:'8px'}}>{job.invoiceNo || 'PENDING'}</td></tr>
                                        <tr><td style={{padding:'8px', textAlign:'right', color:'#666'}}>DATE:</td><td style={{padding:'8px'}}>{job.invoiceDate || new Date().toLocaleDateString()}</td></tr>
                                        {job.insurance.claim && <tr><td style={{padding:'8px', textAlign:'right', color:'#666'}}>CLAIM REF:</td><td style={{padding:'8px'}}>{job.insurance.claim}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            <p style={{fontSize:'22px', lineHeight:'1.6', maxWidth:'700px', margin:'0 auto 40px auto'}}>I, <strong>{job.client.name}</strong>, hereby confirm that the repairs to the vehicle listed above have been completed to my total satisfaction.</p>
                            <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                                {job.vault.signature ? <img src={job.vault.signature} style={{width:'300px', borderBottom:'2px solid #000', paddingBottom:'10px'}} alt="Signature" /> : <div style={{width:'300px', height:'100px', borderBottom:'2px solid #000'}}></div>}
                                <p style={{marginTop:'10px', fontSize:'18px', fontWeight:'bold'}}>SIGNED</p>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <table style={{width:'100%', marginTop:'10px', borderCollapse:'collapse', fontSize:'12px'}}>
                                <thead><tr style={{background:'#eee', borderBottom:'2px solid #ddd'}}><th style={{padding:'8px', textAlign:'left'}}>Task</th><th style={{padding:'8px', textAlign:'right'}}>{docType === 'JOB CARD' ? 'Check' : 'Amount'}</th></tr></thead>
                                <tbody>
                                    {printMode !== 'EXCESS' && (
                                        <>
                                            {(job.repair.items || []).map((it, i) => (
                                                <tr key={it.id} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'8px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'8px', fontWeight:'bold'}}>{docType === 'JOB CARD' ? '[   ]' : `£${(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}`}</td></tr>
                                            ))}
                                            {parseFloat(job.repair.paintMats) > 0 && <tr style={{borderBottom:'1px solid #eee'}}><td style={{padding:'8px'}}>Paint & Materials</td><td style={{textAlign:'right', padding:'8px', fontWeight:'bold'}}>{docType === 'JOB CARD' ? '[   ]' : `£${parseFloat(job.repair.paintMats).toFixed(2)}`}</td></tr>}
                                            <tr><td style={{padding:'8px'}}>Bodywork Labour ({totals.lHrs} hrs)</td><td style={{textAlign:'right', padding:'8px', fontWeight:'bold'}}>{docType === 'JOB CARD' ? '[   ]' : `£${totals.lPrice.toFixed(2)}`}</td></tr>
                                            {docType !== 'JOB CARD' && (
                                                <>
                                                    <tr style={{borderTop:'2px solid #777'}}><td style={{padding:'8px', textAlign:'right', fontWeight:'bold'}}>Net Total:</td><td style={{textAlign:'right', padding:'8px'}}>£{(totals.total / (1 + (parseFloat(settings.vatRate)/100))).toFixed(2)}</td></tr>
                                                    <tr><td style={{padding:'8px', textAlign:'right'}}>VAT @ {settings.vatRate}%:</td><td style={{textAlign:'right', padding:'8px'}}>£{(totals.total - (totals.total / (1 + (parseFloat(settings.vatRate)/100)))).toFixed(2)}</td></tr>
                                                </>
                                            )}
                                        </>
                                    )}
                                    {printMode === 'EXCESS' && <tr><td style={{padding:'8px'}}>Insurance Excess</td><td style={{textAlign:'right', padding:'8px', fontWeight:'bold'}}>£{parseFloat(job.repair.excess || 0).toFixed(2)}</td></tr>}
                                </tbody>
                            </table>
                            {docType === 'JOB CARD' ? (
                                <div style={{marginTop:'30px', border:'2px dashed #333', padding:'20px'}}>
                                    <h3 style={{marginTop:0}}>INTERNAL NOTES:</h3>
                                    <p style={{fontSize:'16px', whiteSpace:'pre-wrap'}}>{job.repair.techNotes || 'None'}</p>
                                    <div style={{marginTop:'50px', borderTop:'1px solid black', width:'200px'}}>Quality Sign-off</div>
                                </div>
                            ) : (
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'30px'}}>
                                    <div style={{flex:1, textAlign:'center', border:'4px solid #f97316', borderRadius:'20px', padding:'20px', marginRight:'20px'}}>
                                        <div style={{fontSize:'22px', fontWeight:'900', marginBottom:'10px'}}>BACS:<br/>{settings.bank}</div>
                                        {settings.paypalQr && <img src={settings.paypalQr} style={{height:'150px'}} alt="QR" />}
                                    </div>
                                    <div style={{flex:1, textAlign:'right'}}>
                                        <h1 style={{fontSize:'45px', margin:0, color:'#f97316'}}>£{printMode === 'EXCESS' ? parseFloat(job.repair.excess||0).toFixed(2) : printMode === 'INSURER' ? totals.insurer.toFixed(2) : totals.total.toFixed(2)}</h1>
                                    </div>
                                </div>
                            )}
                            {docType !== 'JOB CARD' && settings.terms && (
                                <div style={{pageBreakBefore: 'always', paddingTop: '20px'}}>
                                    <h2 style={{color:'#f97316', borderBottom:'4px solid #f97316', paddingBottom:'10px', fontSize:'18px', margin:0}}>TERMS</h2>
                                    <div style={{columnCount: 2, columnGap: '30px', fontSize:'10px', lineHeight:'1.4', marginTop:'15px', whiteSpace: 'pre-wrap'}}>{settings.terms}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="no-print" style={{marginTop:'50px', borderTop:'2px solid #eee', paddingTop:'20px', paddingBottom:'80px', textAlign:'center', maxWidth:'600px', margin:'50px auto'}}>
                    <button style={{...s.btnG(theme.hub), width:'100%', fontSize:'26px', padding:'30px', border:'5px solid #fff'}} onClick={() => window.print()}>🖨️ OPEN PRINTER</button>
                </div>
                <style>{`
                    @media screen { body { background: #fff !important; } }
                    @media print { .no-print { display: none !important; } body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
                `}</style>
            </div>
        );
    }

    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '180px' }}>
            {loading && <LoadingOverlay />}
            <div className="no-print">
                {view === 'HUB' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <h1 style={{color:theme.hub, fontSize:'65px', letterSpacing:'-4px', marginBottom:'45px', textAlign:'center'}}>COMMAND HUB</h1>
                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>Vehicle ID</span>
                            <div style={{display:'flex', gap:'12px', marginBottom:'20px'}}>
                                <input style={{...s.input, flex:4, fontSize:'55px', textAlign:'center', border:`5px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                                <button style={{...s.btnG(theme.hub), flex:1, fontSize:'20px'}} onClick={runDVLA}>FIND</button>
                            </div>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                                <div><span style={s.label}>MAKE</span><input style={s.input} value={job.vehicle.make} onChange={e=>setJob({...job, vehicle:{...job.vehicle, make:e.target.value}})} /></div>
                                <div><span style={s.label}>SPEC</span><input style={s.input} value={job.vehicle.year} onChange={e=>setJob({...job, vehicle:{...job.vehicle, year:e.target.value}})} /></div>
                                <div><span style={s.label}>COLOUR</span><input style={s.input} value={job.vehicle.colour} onChange={e=>setJob({...job, vehicle:{...job.vehicle, colour:e.target.value}})} /></div>
                                <div><span style={s.label}>VIN</span><input style={s.input} value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} /></div>
                                <div><span style={s.label}>MILEAGE</span><input style={s.input} value={job.vehicle.mileage} onChange={e=>setJob({...job, vehicle:{...job.vehicle, mileage:e.target.value}})} /></div>
                                <div><span style={s.label}>FUEL</span><input style={s.input} value={job.vehicle.fuelLevel} onChange={e=>setJob({...job, vehicle:{...job.vehicle, fuelLevel:e.target.value}})} /></div>
                            </div>
                        </div>
                        <div style={s.card(theme.deal)}>
                            <span style={s.label}>Stakeholders</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                                <div>
                                    <span style={{...s.label, color:theme.deal}}>CLIENT</span>
                                    <input style={s.input} placeholder="Name" value={job.client.name} onChange={e => { const val = e.target.value; setJob({...job, client:{...job.client, name:val}}); checkClientMatch(val); }} />
                                    {clientMatch && ( <div style={{background:'#111', border:`1px solid ${theme.deal}`, padding:'10px', borderRadius:'10px', marginBottom:'15px', cursor:'pointer'}} onClick={autofillClient}><span style={{color:theme.deal, fontWeight:'bold'}}>✨ FOUND PREVIOUS</span></div> )}
                                    <input style={s.input} placeholder="Address" value={job.client.address} onChange={e=>setJob({...job, client:{...job.client, address:e.target.value}})} />
                                    <input style={s.input} placeholder="Phone" value={job.client.phone} onChange={e=>setJob({...job, client:{...job.client, phone:e.target.value}})} />
                                    <input style={s.input} placeholder="Email" value={job.client.email} onChange={e=>setJob({...job, client:{...job.client, email:e.target.value}})} />
                                </div>
                                <div>
                                    <span style={{...s.label, color:theme.set}}>INSURANCE</span>
                                    <input style={s.input} placeholder="Company" value={job.insurance.name} onChange={e=>setJob({...job, insurance:{...job.insurance, name:e.target.value}})} />
                                    <input style={s.input} placeholder="Address" value={job.insurance.address} onChange={e=>setJob({...job, insurance:{...job.insurance, address:e.target.value}})} />
                                    <input style={s.input} placeholder="Phone" value={job.insurance.phone} onChange={e=>setJob({...job, insurance:{...job.insurance, phone:e.target.value}})} />
                                    <input style={s.input} placeholder="Email" value={job.insurance.email} onChange={e=>setJob({...job, insurance:{...job.insurance, email:e.target.value}})} />
                                    <input style={s.input} placeholder="Claim #" value={job.insurance.claim} onChange={e=>setJob({...job, insurance:{...job.insurance, claim:e.target.value}})} />
                                </div>
                            </div>
                        </div>
                        <div style={s.card(theme.work)}>
                            <button style={{...s.btnG(theme.deal), width:'100%', padding:'35px', fontSize:'32px'}} onClick={()=>setView('EST')}>OPEN ESTIMATOR</button>
                        </div>
                        <button style={{...s.btnG(theme.danger), width:'100%', padding:'25px'}} onClick={resetJob}>⚠️ START NEW JOB</button>
                    </div>
                )}
                {view === 'EST' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <div style={s.navBar}><button style={{...s.btnG('#222'), flex:1}} onClick={() => setView('HUB')}>⬅️ BACK TO HUB</button></div>
                        <div style={s.card(theme.work)}>
                            <span style={s.label}>Repairs</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'15px', marginBottom:'35px'}}>
                                <div><span style={s.label}>MET</span><input style={s.input} value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} /></div>
                                <div><span style={s.label}>PANEL</span><input style={s.input} value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} /></div>
                                <div><span style={s.label}>PAINT</span><input style={s.input} value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} /></div>
                            </div>
                            <span style={s.label}>PAINT & MATS (£)</span>
                            <input style={{...s.input, border:`3px solid ${theme.work}`}} value={job.repair.paintMats} onChange={e=>setJob({...job, repair:{...job.repair, paintMats:e.target.value}})} />
                            {job.repair.items.map((it, i) => (
                                <div key={i} style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                                    <input style={{...s.input, flex:3, marginBottom:0}} value={it.desc} onChange={(e) => { const n = [...job.repair.items]; n[i].desc = e.target.value; setJob({...job, repair:{...job.repair, items: n}}); }} />
                                    <input style={{...s.input, flex:1, marginBottom:0}} value={it.cost} onChange={(e) => { const n = [...job.repair.items]; n[i].cost = e.target.value; setJob({...job, repair:{...job.repair, items: n}}); }} />
                                    <button style={{...s.btnG(theme.danger), padding:'15px'}} onClick={() => { const n = job.repair.items.filter((_, idx) => idx !== i); setJob({...job, repair:{...job.repair, items: n}}); }}>X</button>
                                </div>
                            ))}
                            <button style={{...s.btnG(theme.work), width:'100%'}} onClick={() => setJob({...job, repair:{...job.repair, items: [...(job.repair.items || []), { desc: '', cost: '' }]}})}>+ ADD ITEM</button>
                            <span style={{...s.label, marginTop:'30px'}}>Tech Notes</span>
                            <textarea style={s.textarea} value={job.repair.techNotes} onChange={e=>setJob({...job, repair:{...job.repair, techNotes:e.target.value}})} />
                        </div>
                        <div style={s.card(theme.deal)}>
                            <h2 style={{fontSize:'45px', textAlign:'right'}}>£{totals.total.toFixed(2)}</h2>
                            <span style={s.label}>Excess</span><input style={s.input} value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginTop:'10px'}}>
                                <button style={{...s.btnG('#333'), fontSize:'12px'}} onClick={() => openDocument('INVOICE', 'FULL')}>FULL INVOICE</button>
                                <button style={{...s.btnG(theme.deal), fontSize:'12px'}} onClick={() => openDocument('INVOICE', 'INSURER')}>INSURER NET</button>
                                <button style={{...s.btnG(theme.danger), fontSize:'12px'}} onClick={() => openDocument('INVOICE', 'EXCESS')}>CUST EXCESS</button>
                            </div>
                            <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                                <button style={{...s.btnG(theme.work), flex:1, fontSize:'14px'}} onClick={() => openDocument('ESTIMATE', 'FULL')}>ESTIMATE</button>
                                <button style={{...s.btnG(theme.work), flex:1, fontSize:'14px', background:'#f59e0b', color:'black'}} onClick={() => openDocument('JOB CARD', 'FULL')}>JOB CARD</button>
                            </div>
                        </div>
                    </div>
                )}
                {view === 'SAT' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <div style={s.navBar}><button style={{...s.btnG('#222'), flex:1}} onClick={() => setView('HUB')}>⬅️ BACK TO HUB</button></div>
                        <div style={s.card(theme.deal)}>
                            <NativeSignature onSave={(sig) => setJob({...job, vault: {...job.vault, signature: sig}})} />
                            <button style={{...s.btnG(theme.deal), width:'100%'}} onClick={() => openDocument('SATISFACTION NOTE', 'FULL')}>VIEW NOTE</button>
                        </div>
                    </div>
                )}
                {view === 'SET' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <div style={s.navBar}><button style={{...s.btnG('#222'), flex:1}} onClick={() => setView('HUB')}>⬅️ BACK TO HUB</button></div>
                        <div style={s.card(theme.set)}>
                            <input style={s.input} placeholder="Name" value={settings.coName} onChange={e=>setSettings({...settings, coName:e.target.value})} />
                            <input style={s.input} placeholder="Bank" value={settings.bank} onChange={e=>setSettings({...settings, bank:e.target.value})} />
                            <input style={s.input} placeholder="API" value={settings.dvlaKey} onChange={e=>setSettings({...settings, dvlaKey:e.target.value})} />
                            <button style={{...s.btnG(theme.deal), width:'100%'}} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Saved."); }}>SAVE</button>
                        </div>
                    </div>
                )}
                {view === 'RECENT' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <div style={s.navBar}><button style={{...s.btnG('#222'), flex:1}} onClick={() => setView('HUB')}>⬅️ BACK TO HUB</button></div>
                        <input style={s.input} placeholder="Search..." value={vaultSearch} onChange={(e) => setVaultSearch(e.target.value)}/>
                        {history.filter(h => JSON.stringify(h).toLowerCase().includes(vaultSearch.toLowerCase())).map((h) => (
                            <div key={h.id} style={{...s.card('#333'), display:'flex', justifyContent:'space-between', alignItems:'center', padding:'25px'}}>
                                <div><h2 style={{margin:0}}>{h.vehicle?.reg}</h2><p style={{margin:0}}>{h.client?.name}</p></div>
                                <div style={{display:'flex', gap:'10px'}}><button style={{...s.btnG(theme.deal), padding:'10px 20px'}} onClick={() => loadJob(h)}>OPEN</button><button style={{...s.btnG(theme.danger), padding:'10px 20px'}} onClick={() => deleteJob(h.id)}>DEL</button></div>
                            </div>
                        ))}
                    </div>
                )}
                {view === 'FIN' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <div style={s.navBar}><button style={{...s.btnG('#222'), flex:1}} onClick={() => setView('HUB')}>⬅️ BACK TO HUB</button></div>
                        <button style={{...s.btnG(theme.fin), width:'100%', marginBottom:'30px'}} onClick={downloadCSV}>TAX LEDGER (CSV)</button>
                    </div>
                )}
                <div className="no-print" style={s.dock}>
                    <button onClick={()=>setView('HUB')} style={{...s.btnG(view==='HUB'?theme.hub:'#222'), minWidth:'100px'}}>HUB</button>
                    <button onClick={()=>setView('EST')} style={{...s.btnG(view==='EST'?theme.hub:'#222'), minWidth:'100px'}}>EST</button>
                    <button onClick={()=>setView('SAT')} style={{...s.btnG(view==='SAT'?theme.deal:'#222'), minWidth:'100px'}}>SAT</button>
                    <button onClick={()=>window.open('https://calendar.google.com/calendar/u/0/r?cid=markmonie72@gmail.com', '_blank')} style={{...s.btnG(theme.set), minWidth:'100px'}}>CAL</button>
                    <button onClick={()=>setView('FIN')} style={{...s.btnG(theme.fin), minWidth:'100px'}}>FIN</button>
                    <button onClick={()=>setView('RECENT')} style={{...s.btnG('#333'), minWidth:'100px'}}>JOBS</button>
                    <button onClick={()=>setView('SET')} style={{...s.btnG('#222'), minWidth:'100px'}}>SET</button>
                    <button style={{...s.btnG(theme.deal), minWidth:'180px'}} onClick={saveMaster}>SAVE</button>
                </div>
            </div>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
