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

// --- THEME & STYLES ---
const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', fin: '#8b5cf6', bg: '#000', card: '#111', text: '#f8fafc', border: '#333', danger: '#ef4444' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '32px', padding: '30px', marginBottom: '30px', border: `2px solid ${theme.border}`, borderTop: `14px solid ${color || theme.hub}`, boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }),
    input: { width: '100%', background: '#050505', border: '2px solid #444', color: '#fff', padding: '18px', borderRadius: '12px', marginBottom: '15px', outline: 'none', fontSize: '18px', fontWeight: 'bold', boxSizing: 'border-box', transition: 'border 0.2s' },
    textarea: { width: '100%', background: '#050505', border: '2px solid #444', color: '#fff', padding: '18px', borderRadius: '12px', marginBottom: '15px', outline: 'none', fontSize: '16px', fontWeight: '500', minHeight: '120px', boxSizing: 'border-box', fontFamily: 'Arial' },
    label: { color: '#94a3b8', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px', display: 'block', letterSpacing: '1.5px' },
    displayBox: { background: '#050505', padding: '20px', borderRadius: '18px', border: '2px solid #222', marginBottom: '20px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '18px 25px', borderRadius: '15px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'transform 0.1s', fontSize: '15px', flexShrink: 0, userSelect: 'none', width: '100%' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)', padding: '15px 20px', display: 'flex', gap: '12px', overflowX: 'auto', borderTop: '1px solid #333', zIndex: 9000 },
    navBar: { display: 'flex', gap: '15px', marginBottom: '30px' },
    loader: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontSize: '24px', flexDirection: 'column', fontWeight: 'bold', letterSpacing: '2px' }
};

const LoadingOverlay = ({ text }) => (
    <div style={s.loader}>
        <div style={{border: '4px solid #333', borderTop: `4px solid ${theme.hub}`, borderRadius: '50%', width: '60px', height: '60px', animation: 'spin 0.8s linear infinite', marginBottom:'25px'}}></div>
        {text || "PROCESSING..."}
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
        <div style={{ background: '#fff', borderRadius: '15px', padding: '10px', marginBottom:'20px', border:'2px solid #444' }}>
            <canvas ref={canvasRef} width={400} height={200} onMouseDown={start} onMouseMove={move} onMouseUp={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} style={{ width: '100%', height: '200px', touchAction: 'none' }} />
            <button style={{ ...s.btnG('#222'), marginTop: '10px' }} onClick={() => { canvasRef.current.getContext('2d').clearRect(0,0,400,200); onSave(''); }}>CLEAR PAD</button>
        </div>
    );
};

const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    const [loadMsg, setLoadMsg] = useState('');
    
    // --- STATE VARIABLES ---
    const [docType, setDocType] = useState('ESTIMATE'); 
    const [printMode, setPrintMode] = useState('FULL'); 
    const [history, setHistory] = useState([]);
    const [vaultSearch, setVaultSearch] = useState('');
    const [clientMatch, setClientMatch] = useState(null);
    
    // --- GLOBAL SETTINGS ---
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: 'Sort Code: 80-22-60 | Acc: 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'lXqv1yDD1IatEPHlntk2w8MEuz9X57lE9TP9sxGc', logoUrl: '', paypalQr: '',
        terms: 'TERMS & CONDITIONS\n\n1. Payment due on completion.\n2. Vehicles left at owner risk.',
        invoiceCount: 1000 
    });

    const INITIAL_JOB = {
        status: 'STRIPPING', lastSuccess: '', invoiceNo: '',
        client: { name: '', address: '', phone: '', email: '', claim: '' },
        insurance: { name: '', address: '', phone: '', email: '', claim: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', colour: '', fuel: '', engine: '', mot: '', motExpiry: '', mileage: '', fuelLevel: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0', techNotes: '' },
        vault: { signature: '', expenses: [] }
    };

    const [job, setJob] = useState(INITIAL_JOB);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const saved = localStorage.getItem('mmm_v500_MASTER');
        if (saved) setJob(JSON.parse(saved));
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('mmm_v500_MASTER', JSON.stringify(job)); }, [job]);

    // --- CLIENT MEMORY ---
    const checkClientMatch = (name) => {
        if(!name || name.length < 3) { setClientMatch(null); return; }
        const match = history.find(h => h.client?.name?.toLowerCase().includes(name.toLowerCase()));
        if(match) setClientMatch(match.client); else setClientMatch(null);
    };
    const autofillClient = () => { if(clientMatch) { setJob(prev => ({...prev, client: {...prev.client, ...clientMatch}})); setClientMatch(null); } };

    // --- JOB MANAGEMENT ---
    const resetJob = () => {
        if(window.confirm("⚠️ START NEW JOB? This clears current fields.")) {
            localStorage.removeItem('mmm_v500_MASTER');
            setJob(INITIAL_JOB);
            setClientMatch(null); 
            window.scrollTo(0, 0); 
        }
    };

    const loadJob = (savedJob) => { setJob(savedJob); setView('HUB'); window.scrollTo(0,0); };
    const deleteJob = async (id) => { if(window.confirm("PERMANENTLY DELETE RECORD?")) await deleteDoc(doc(db, 'estimates', id)); };

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

    // --- INTELLIGENT DOCUMENT ENGINE ---
    const openDocument = async (type, mode = 'FULL') => {
        setDocType(type);
        setPrintMode(mode);
        setLoadMsg('GENERATING DOCUMENT...');
        setLoading(true);
        
        let currentInvoiceNo = job.invoiceNo;
        const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY

        // Intelligent Invoice Numbering
        if (type === 'INVOICE' && !currentInvoiceNo) {
            const nextNum = parseInt(settings.invoiceCount || 1000) + 1;
            currentInvoiceNo = nextNum.toString();
            setJob(prev => ({ ...prev, invoiceNo: currentInvoiceNo, invoiceDate: today }));
            setSettings(prev => ({ ...prev, invoiceCount: nextNum }));
            
            // Background Save
            await setDoc(doc(db, 'settings', 'global'), { ...settings, invoiceCount: nextNum });
            await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, invoiceNo: currentInvoiceNo, invoiceDate: today, totals }, { merge: true });
        }

        // Filename Protocol: Date_Reg_Doc#
        const safeDate = today.replace(/\//g, '-');
        const safeReg = (job.vehicle.reg || 'NO-REG').replace(/ /g, '');
        const safeId = currentInvoiceNo || 'DRAFT';
        const filename = `${safeDate}_${safeReg}_${safeId}`;
        
        document.title = filename;

        setLoading(false);
        setView('PREVIEW');
        window.scrollTo(0,0);
    };

    // --- DVLA INTELLIGENCE (PROXY ROTATOR) ---
    const runDVLA = async () => {
        if (!job?.vehicle?.reg || !settings.dvlaKey) { alert("Enter Registration & Check API Key"); return; }
        setLoadMsg('SEARCHING DVLA...');
        setLoading(true);
        
        const cleanReg = job.vehicle.reg.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        
        // Strategy: Cascade through proxies until one works
        const proxies = [
            'https://corsproxy.io/?', 
            'https://thingproxy.freeboard.io/fetch/',
            'https://api.allorigins.win/raw?url='
        ];
        const targetUrl = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
        
        let success = false;
        let data = null;

        for (const proxy of proxies) {
            if(success) break;
            try {
                const response = await fetch(proxy + encodeURIComponent(targetUrl), {
                    method: 'POST',
                    headers: { 'x-api-key': settings.dvlaKey.trim(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ registrationNumber: cleanReg })
                });
                if (response.ok) {
                    data = await response.json();
                    if(!data.errors) success = true;
                }
            } catch (e) { console.warn(`Proxy ${proxy} failed.`); }
        }

        if (success && data) {
            setJob(prev => ({
                ...prev, lastSuccess: new Date().toLocaleString('en-GB'),
                vehicle: {
                    ...prev.vehicle, make: data.make, year: data.yearOfManufacture, colour: data.colour, fuel: data.fuelType, 
                    engine: data.engineCapacity, mot: data.motStatus, motExpiry: data.motExpiryDate
                }
            }));
        } else { alert("Could not retrieve vehicle data. Please enter manually."); }
        setLoading(false);
    };

    const downloadCSV = () => {
        const headers = ["Date", "Invoice #", "Reg", "Client", "Total (£)", "Excess (£)", "Status"];
        const rows = history.map(h => [
            new Date(h.createdAt?.seconds * 1000).toLocaleDateString(), h.invoiceNo || '-', h.vehicle.reg, h.client.name,
            (h.totals?.total || 0).toFixed(2), (h.repair?.excess || 0), h.status
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `MMM_Tax_Ledger_${new Date().toLocaleDateString()}.csv`); document.body.appendChild(link); link.click();
    };

    const saveMaster = async () => {
        setLoadMsg('SAVING TO CLOUD...');
        setLoading(true);
        try {
            await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
            alert("Securely Saved.");
        } catch(e) { alert("Save Failed. Check Connection."); }
        setLoading(false);
    };

    const handleFileUpload = async (e, path, field) => {
        const file = e.target.files[0]; if (!file) return;
        setLoadMsg('UPLOADING...');
        setLoading(true);
        try {
            const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
            await uploadBytes(r, file);
            const url = await getDownloadURL(r);
            if (path === 'branding') setSettings(prev => ({...prev, [field]: url}));
            else setJob(prev => ({...prev, vault: {...prev.vault, expenses: [...(prev.vault.expenses || []), url]}}));
        } catch(e) { alert("Upload Failed."); }
        setLoading(false);
    };

    // --- COMPONENT HELPERS ---
    const HeaderNav = () => (
        <div style={s.navBar} className="no-print">
            <button style={{...s.btnG('#222'), width:'auto'}} onClick={() => setView('HUB')}>⬅️ BACK TO HUB</button>
        </div>
    );

    // --- VIEW: PREVIEW DOCUMENT ---
    if (view === 'PREVIEW') {
        return (
            <div style={{background:'#fff', minHeight:'100vh', color:'#000', fontFamily:'Arial'}}>
                {loading && <LoadingOverlay text={loadMsg} />}
                
                {/* ACTION BAR */}
                <div className="no-print" style={{position:'fixed', top:0, left:0, right:0, background:'#111', padding:'15px', zIndex:9999, display:'flex', gap:'10px', boxShadow:'0 4px 20px rgba(0,0,0,0.5)', alignItems:'center'}}>
                    <button style={{...s.btnG('#16a34a'), flex:1, fontSize:'18px'}} onClick={() => window.print()}>🖨️ PRINT</button>
                    <button style={{...s.btnG('#2563eb'), flex:1, fontSize:'18px'}} onClick={() => window.print()}>📄 SAVE PDF</button>
                    <button style={{...s.btnG('#333'), width:'auto', padding:'15px 30px'}} onClick={() => { setView(docType === 'SATISFACTION NOTE' ? 'SAT' : 'EST'); document.title="Triple MMM"; }}>CLOSE</button>
                </div>

                <div style={{padding:'100px 40px 40px 40px'}}>
                    {/* UNIVERSAL HEADER */}
                    <div style={{display:'flex', justifyContent:'space-between', borderBottom:'8px solid #f97316', paddingBottom:'20px', marginBottom:'20px'}}>
                        <div style={{flex:1}}>
                            {settings.logoUrl && <img src={settings.logoUrl} style={{height:'100px', marginBottom:'10px'}} alt="Logo" />}
                            {docType !== 'JOB CARD' && <h1 style={{margin:0, color:'#f97316', fontSize:'32px', letterSpacing:'-1px'}}>{settings.coName}</h1>}
                            <p style={{fontSize:'14px', lineHeight:'1.5', color:'#444'}}>{settings.address}<br/>{settings.phone}</p>
                        </div>
                        <div style={{textAlign:'right', flex:1}}>
                            <h2 style={{color:'#f97316', fontSize:'42px', margin:0, textTransform:'uppercase'}}>{docType === 'JOB CARD' ? 'WORKSHOP JOB CARD' : printMode === 'EXCESS' ? 'INVOICE (EXCESS)' : docType}</h2>
                            <p style={{fontSize:'16px', fontWeight:'bold', marginTop:'10px'}}>Reg: {job.vehicle.reg}</p>
                            <p style={{fontSize:'16px'}}>Date: {job.invoiceDate || new Date().toLocaleDateString()}</p>
                            {job.invoiceNo && docType === 'INVOICE' && <p style={{fontSize:'18px', color:'#f97316', fontWeight:'900'}}>INV #: {job.invoiceNo}</p>}
                            
                            {docType === 'JOB CARD' && (
                                <div style={{marginTop:'15px', fontSize:'14px', fontWeight:'bold', border:'2px solid black', padding:'8px', display:'inline-block'}}>
                                    Mileage: {job.vehicle.mileage || '_______'} | Fuel: {job.vehicle.fuelLevel || '_______'}
                                </div>
                            )}

                            <div style={{marginTop:'20px', fontSize:'13px', borderTop:'1px solid #ccc', paddingTop:'10px', color:'#333'}}>
                                <strong>BILL TO:</strong><br/>
                                {printMode === 'INSURER' ? (
                                    <>{job.insurance.name}<br/>{job.insurance.address}<br/>REF: {job.insurance.claim}</>
                                ) : (
                                    <>{job.client.name}<br/>{job.client.address}<br/>{job.client.email}</>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* DYNAMIC CONTENT SWITCHER */}
                    {docType === 'SATISFACTION NOTE' ? (
                        <div style={{marginTop:'60px', textAlign: 'center'}}>
                            <h1 style={{color:'#f97316', fontSize:'48px', marginBottom:'40px', letterSpacing:'-2px'}}>SATISFACTION NOTE</h1>
                            
                            <div style={{
                                border:'3px solid #000', padding:'25px', borderRadius:'15px', marginBottom:'50px', background:'#f4f4f5', 
                                display: 'inline-block', textAlign: 'left', minWidth: '500px', boxShadow:'0 10px 20px rgba(0,0,0,0.05)'
                            }}>
                                <table style={{width:'100%', fontSize:'18px', fontWeight:'bold', borderCollapse:'collapse'}}>
                                    <tbody>
                                        <tr><td style={{padding:'8px', textAlign:'right', color:'#666', width:'40%'}}>VEHICLE:</td><td style={{padding:'8px'}}>{job.vehicle.make} {job.vehicle.year}</td></tr>
                                        <tr><td style={{padding:'8px', textAlign:'right', color:'#666'}}>REGISTRATION:</td><td style={{padding:'8px'}}>{job.vehicle.reg}</td></tr>
                                        <tr><td style={{padding:'8px', textAlign:'right', color:'#666'}}>INVOICE #:</td><td style={{padding:'8px'}}>{job.invoiceNo || 'PENDING'}</td></tr>
                                        <tr><td style={{padding:'8px', textAlign:'right', color:'#666'}}>DATE:</td><td style={{padding:'8px'}}>{job.invoiceDate || new Date().toLocaleDateString()}</td></tr>
                                        {job.insurance.claim && <tr><td style={{padding:'8px', textAlign:'right', color:'#666'}}>CLAIM REF:</td><td style={{padding:'8px'}}>{job.insurance.claim}</td></tr>}
                                    </tbody>
                                </table>
                            </div>

                            <p style={{fontSize:'24px', lineHeight:'1.6', maxWidth:'700px', margin:'0 auto 60px auto', fontWeight:'500'}}>
                                I, <strong>{job.client.name}</strong>, hereby confirm that the repairs to the vehicle listed above have been completed to my total satisfaction.
                            </p>

                            <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                                {job.vault.signature ? (
                                    <img src={job.vault.signature} style={{width:'350px', borderBottom:'2px solid #000', paddingBottom:'10px'}} alt="Signature" />
                                ) : (
                                    <div style={{width:'350px', height:'100px', borderBottom:'2px solid #000'}}></div>
                                )}
                                <p style={{marginTop:'10px', fontSize:'18px', fontWeight:'bold', textTransform:'uppercase', letterSpacing:'2px'}}>Customer Signature</p>
                            </div>
                        </div>
                    ) : (
                        /* TABLE VIEW (INVOICE / JOB CARD / ESTIMATE) */
                        <div>
                            <table style={{width:'100%', marginTop:'20px', borderCollapse:'collapse', fontSize:'13px'}}>
                                <thead>
                                    <tr style={{background:'#eee', borderBottom:'3px solid #ddd'}}>
                                        <th style={{padding:'12px', textAlign:'left', textTransform:'uppercase'}}>Description</th>
                                        <th style={{padding:'12px', textAlign:'right', textTransform:'uppercase'}}>{docType === 'JOB CARD' ? 'Check' : 'Amount'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {printMode !== 'EXCESS' && (
                                        <>
                                            {(job.repair.items || []).map((it, i) => (
                                                <tr key={it.id} style={{borderBottom:'1px solid #eee'}}>
                                                    <td style={{padding:'12px'}}>{it.desc}</td>
                                                    <td style={{textAlign:'right', padding:'12px', fontWeight:'bold'}}>{docType === 'JOB CARD' ? '[   ]' : `£${(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}`}</td>
                                                </tr>
                                            ))}
                                            {parseFloat(job.repair.paintMats) > 0 && (
                                                <tr style={{borderBottom:'1px solid #eee'}}>
                                                    <td style={{padding:'12px'}}>Paint & Materials</td>
                                                    <td style={{textAlign:'right', padding:'12px', fontWeight:'bold'}}>{docType === 'JOB CARD' ? '[   ]' : `£${parseFloat(job.repair.paintMats).toFixed(2)}`}</td>
                                                </tr>
                                            )}
                                            <tr>
                                                <td style={{padding:'12px'}}>Qualified Bodywork Labour ({totals.lHrs} hrs)</td>
                                                <td style={{textAlign:'right', padding:'12px', fontWeight:'bold'}}>{docType === 'JOB CARD' ? '[   ]' : `£${totals.lPrice.toFixed(2)}`}</td>
                                            </tr>
                                            {docType !== 'JOB CARD' && (
                                                <>
                                                    <tr style={{borderTop:'3px solid #eee'}}><td style={{padding:'12px', textAlign:'right', fontWeight:'bold'}}>Net Subtotal:</td><td style={{textAlign:'right', padding:'12px'}}>£{(totals.total / (1 + (parseFloat(settings.vatRate)/100))).toFixed(2)}</td></tr>
                                                    <tr><td style={{padding:'12px', textAlign:'right'}}>VAT @ {settings.vatRate}%:</td><td style={{textAlign:'right', padding:'12px'}}>£{(totals.total - (totals.total / (1 + (parseFloat(settings.vatRate)/100)))).toFixed(2)}</td></tr>
                                                </>
                                            )}
                                        </>
                                    )}
                                    {printMode === 'EXCESS' && (
                                        <tr>
                                            <td style={{padding:'12px'}}>Insurance Excess Contribution</td>
                                            <td style={{textAlign:'right', padding:'12px', fontWeight:'bold'}}>£{parseFloat(job.repair.excess || 0).toFixed(2)}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {docType === 'JOB CARD' ? (
                                <div style={{marginTop:'40px', border:'3px dashed #ccc', padding:'25px', borderRadius:'10px'}}>
                                    <h3 style={{marginTop:0, color:'#666'}}>INTERNAL TECH NOTES:</h3>
                                    <p style={{fontSize:'16px', whiteSpace:'pre-wrap', fontFamily:'monospace'}}>{job.repair.techNotes || 'No specific notes.'}</p>
                                    <div style={{marginTop:'60px', borderTop:'2px solid black', width:'250px', paddingTop:'5px'}}>Quality Control Sign-off</div>
                                </div>
                            ) : (
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'40px', background:'#f9f9f9', padding:'20px', borderRadius:'15px'}}>
                                    <div style={{flex:1, textAlign:'center'}}>
                                        <div style={{fontSize:'22px', fontWeight:'900', marginBottom:'10px'}}>BACS PAYMENT</div>
                                        <div style={{fontSize:'16px'}}>{settings.bank}</div>
                                        {settings.paypalQr && <img src={settings.paypalQr} style={{height:'120px', marginTop:'10px'}} alt="QR" />}
                                    </div>
                                    <div style={{flex:1, textAlign:'right'}}>
                                        <h1 style={{fontSize:'50px', margin:0, color:'#f97316'}}>£{printMode === 'EXCESS' ? parseFloat(job.repair.excess||0).toFixed(2) : printMode === 'INSURER' ? totals.insurer.toFixed(2) : totals.total.toFixed(2)}</h1>
                                        {printMode === 'INSURER' && <div style={{marginTop:'5px', color:'#f97316', fontSize:'12px', fontWeight:'bold'}}>*LESS EXCESS OF £{job.repair.excess}</div>}
                                    </div>
                                </div>
                            )}

                            {docType !== 'JOB CARD' && settings.terms && (
                                <div style={{pageBreakBefore: 'always', paddingTop: '40px'}}>
                                    <h2 style={{color:'#f97316', borderBottom:'4px solid #f97316', paddingBottom:'10px', fontSize:'20px', margin:0}}>TERMS & CONDITIONS</h2>
                                    <div style={{columnCount: 2, columnGap: '40px', fontSize:'11px', lineHeight:'1.5', marginTop:'20px', whiteSpace: 'pre-wrap', color:'#333'}}>{settings.terms}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <style>{`@media print { .no-print { display: none !important; } body { background: white !important; overflow: visible !important; } }`}</style>
            </div>
        );
    }

    // --- VIEW: APP HUB ---
    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '120px' }}>
            {loading && <LoadingOverlay text={loadMsg} />}
            <div className="no-print">
                {/* HUB */}
                {view === 'HUB' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <h1 style={{color:theme.hub, fontSize:'65px', letterSpacing:'-3px', marginBottom:'45px', textAlign:'center', fontWeight:'900'}}>COMMAND HUB</h1>
                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>Technical ID</span>
                            <div style={{display:'flex', gap:'12px', marginBottom:'20px'}}>
                                <input style={{...s.input, flex:4, fontSize:'55px', textAlign:'center', border:`4px solid ${theme.hub}`, height:'80px', letterSpacing:'5px'}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="ENTER REG" />
                                <button style={{...s.btnG(theme.hub), flex:1, fontSize:'24px'}} onClick={runDVLA}>FIND</button>
                            </div>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                                <div><span style={s.label}>MAKE</span><input style={s.input} value={job.vehicle.make} onChange={e=>setJob({...job, vehicle:{...job.vehicle, make:e.target.value}})} /></div>
                                <div><span style={s.label}>MODEL</span><input style={s.input} value={job.vehicle.year} onChange={e=>setJob({...job, vehicle:{...job.vehicle, year:e.target.value}})} /></div>
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
                                    {clientMatch && ( <div style={{background:'#111', border:`1px solid ${theme.deal}`, padding:'10px', borderRadius:'10px', marginBottom:'15px', cursor:'pointer'}} onClick={autofillClient}><span style={{color:theme.deal, fontWeight:'bold'}}>✨ FOUND: {clientMatch.name}</span></div> )}
                                    <input style={s.input} placeholder="Address" value={job.client.address} onChange={e=>setJob({...job, client:{...job.client, address:e.target.value}})} />
                                    <input style={s.input} placeholder="Phone" value={job.client.phone} onChange={e=>setJob({...job, client:{...job.client, phone:e.target.value}})} />
                                    <input style={s.input} placeholder="Email" value={job.client.email} onChange={e=>setJob({...job, client:{...job.client, email:e.target.value}})} />
                                </div>
                                <div>
                                    <span style={{...s.label, color:theme.set}}>INSURANCE</span>
                                    <input style={s.input} placeholder="Provider" value={job.insurance.name} onChange={e=>setJob({...job, insurance:{...job.insurance, name:e.target.value}})} />
                                    <input style={s.input} placeholder="Address" value={job.insurance.address} onChange={e=>setJob({...job, insurance:{...job.insurance, address:e.target.value}})} />
                                    <input style={s.input} placeholder="Phone" value={job.insurance.phone} onChange={e=>setJob({...job, insurance:{...job.insurance, phone:e.target.value}})} />
                                    <input style={s.input} placeholder="Email" value={job.insurance.email} onChange={e=>setJob({...job, insurance:{...job.insurance, email:e.target.value}})} />
                                    <input style={s.input} placeholder="Claim #" value={job.insurance.claim} onChange={e=>setJob({...job, insurance:{...job.insurance, claim:e.target.value}})} />
                                </div>
                            </div>
                        </div>

                        <div style={s.card(theme.work)}>
                            <span style={s.label}>Workflow</span>
                            <div style={{...s.displayBox, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <div><span style={s.label}>ESTIMATED COMPLETION</span><div style={{color:theme.hub, fontSize:'24px', fontWeight:'900'}}>{projectedDate}</div></div>
                                <button style={{...s.btnG(theme.deal), width:'auto', fontSize:'20px', padding:'15px 30px'}} onClick={()=>setView('EST')}>OPEN ESTIMATOR ➡️</button>
                            </div>
                        </div>
                        <button style={{...s.btnG(theme.danger), width:'100%', marginTop:'20px', padding:'20px'}} onClick={resetJob}>⚠️ START NEW JOB (CLEAR ALL)</button>
                    </div>
                )}

                {/* ESTIMATOR */}
                {view === 'EST' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav />
                        <div style={s.card(theme.work)}>
                            <span style={s.label}>Labour & Materials</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'15px', marginBottom:'30px'}}>
                                <div><span style={s.label}>MET HRS</span><input style={s.input} value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} /></div>
                                <div><span style={s.label}>PANEL HRS</span><input style={s.input} value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} /></div>
                                <div><span style={s.label}>PAINT HRS</span><input style={s.input} value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} /></div>
                            </div>
                            <span style={s.label}>PAINT MATERIALS (£)</span>
                            <input style={{...s.input, border:`2px solid ${theme.work}`}} value={job.repair.paintMats} onChange={e=>setJob({...job, repair:{...job.repair, paintMats:e.target.value}})} placeholder="0.00" />

                            <span style={{...s.label, marginTop:'20px'}}>Line Items</span>
                            {job.repair.items.map((it, i) => (
                                <div key={i} style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                                    <input style={{...s.input, flex:3, marginBottom:0}} value={it.desc} placeholder="Description" onChange={(e) => { const n = [...job.repair.items]; n[i].desc = e.target.value; setJob({...job, repair:{...job.repair, items: n}}); }} />
                                    <input style={{...s.input, flex:1, marginBottom:0}} value={it.cost} placeholder="£" onChange={(e) => { const n = [...job.repair.items]; n[i].cost = e.target.value; setJob({...job, repair:{...job.repair, items: n}}); }} />
                                    <button style={{...s.btnG(theme.danger), width:'auto', padding:'0 20px'}} onClick={() => { const n = job.repair.items.filter((_, idx) => idx !== i); setJob({...job, repair:{...job.repair, items: n}}); }}>X</button>
                                </div>
                            ))}
                            <button style={{...s.btnG(theme.work), marginTop:'15px'}} onClick={() => setJob({...job, repair:{...job.repair, items: [...job.repair.items, { desc: '', cost: '' }]}})}>+ ADD ITEM</button>
                            
                            <span style={{...s.label, marginTop:'30px', color:theme.work}}>Internal Notes (Job Card Only)</span>
                            <textarea style={s.textarea} value={job.repair.techNotes} onChange={e=>setJob({...job, repair:{...job.repair, techNotes:e.target.value}})} placeholder="Technician instructions..." />
                        </div>

                        <div style={s.card(theme.deal)}>
                            <h2 style={{fontSize:'50px', textAlign:'right', margin:'0 0 20px 0'}}>£{totals.total.toFixed(2)}</h2>
                            <span style={{...s.label, color:theme.danger}}>CUSTOMER EXCESS</span>
                            <input style={{...s.input, borderColor:theme.danger}} placeholder="-£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                            
                            <span style={s.label}>INVOICE DATE</span>
                            <input style={s.input} value={job.invoiceDate} onChange={e=>setJob({...job, invoiceDate:e.target.value})} placeholder="DD/MM/YYYY" />

                            <span style={s.label}>ACTIONS</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'15px'}}>
                                <button style={s.btnG('#333')} onClick={() => openDocument('INVOICE', 'FULL')}>FULL INV</button>
                                <button style={s.btnG(theme.deal)} onClick={() => openDocument('INVOICE', 'INSURER')}>INSURER</button>
                                <button style={s.btnG(theme.danger)} onClick={() => openDocument('INVOICE', 'EXCESS')}>EXCESS</button>
                            </div>
                            <div style={{display:'flex', gap:'10px'}}>
                                <button style={s.btnG(theme.work)} onClick={() => openDocument('ESTIMATE', 'FULL')}>ESTIMATE</button>
                                <button style={s.btnG('#f59e0b')} onClick={() => openDocument('JOB CARD', 'FULL')}>JOB CARD</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* SATISFACTION */}
                {view === 'SAT' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav />
                        <div style={s.card(theme.deal)}>
                            <h1 style={{textAlign:'center', color:theme.deal}}>SIGN OFF</h1>
                            <NativeSignature onSave={(sig) => setJob({...job, vault: {...job.vault, signature: sig}})} />
                            <button style={s.btnG(theme.deal)} onClick={() => openDocument('SATISFACTION NOTE', 'FULL')}>PREVIEW SAT NOTE</button>
                        </div>
                    </div>
                )}

                {/* SETTINGS */}
                {view === 'SET' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav />
                        <div style={s.card(theme.set)}>
                            <span style={s.label}>Company</span>
                            <input style={s.input} placeholder="Name" value={settings.coName} onChange={e=>setSettings({...settings, coName:e.target.value})} />
                            <input style={s.input} placeholder="Bank Details" value={settings.bank} onChange={e=>setSettings({...settings, bank:e.target.value})} />
                            <input style={s.input} placeholder="DVLA API Key" value={settings.dvlaKey} onChange={e=>setSettings({...settings, dvlaKey:e.target.value})} />
                            
                            <span style={s.label}>Rates</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'15px'}}>
                                <input style={s.input} placeholder="Markup %" value={settings.markup} onChange={e=>setSettings({...settings, markup:e.target.value})} />
                                <input style={s.input} placeholder="Labour £" value={settings.labourRate} onChange={e=>setSettings({...settings, labourRate:e.target.value})} />
                                <input style={s.input} placeholder="VAT %" value={settings.vatRate} onChange={e=>setSettings({...settings, vatRate:e.target.value})} />
                            </div>

                            <span style={s.label}>Invoice Counter</span>
                            <input style={s.input} type="number" value={settings.invoiceCount} onChange={e=>setSettings({...settings, invoiceCount:e.target.value})} />
                            
                            <span style={s.label}>Assets</span>
                            <input type="file" onChange={(e) => handleFileUpload(e, 'branding', 'logoUrl')} style={{marginBottom:'10px', color:'#fff'}} />
                            <input type="file" onChange={(e) => handleFileUpload(e, 'branding', 'paypalQr')} style={{marginBottom:'20px', color:'#fff'}} />
                            
                            <span style={s.label}>Legal</span>
                            <textarea style={s.textarea} value={settings.terms} onChange={e=>setSettings({...settings, terms:e.target.value})} />
                            
                            <button style={s.btnG(theme.deal)} onClick={async () => { setLoading(true); await setDoc(doc(db, 'settings', 'global'), settings); setLoading(false); alert("Settings Saved"); }}>SAVE ALL</button>
                        </div>
                    </div>
                )}

                {/* ARCHIVE */}
                {view === 'RECENT' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav />
                        <h1 style={{color:theme.hub, marginBottom:'30px'}}>ARCHIVE</h1>
                        <input style={s.input} placeholder="Search..." value={vaultSearch} onChange={(e) => setVaultSearch(e.target.value)}/>
                        {history.filter(h => JSON.stringify(h).toLowerCase().includes(vaultSearch.toLowerCase())).map((h) => (
                            <div key={h.id} style={{...s.card('#222'), display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px'}}>
                                <div>
                                    <h3 style={{margin:0, color:theme.hub}}>{h.vehicle?.reg || 'UNKNOWN'}</h3>
                                    <p style={{margin:0, color:'#888', fontSize:'12px'}}>{h.client?.name} | {new Date(h.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                                </div>
                                <div style={{display:'flex', gap:'10px'}}>
                                    <button style={{...s.btnG(theme.deal), padding:'10px 15px'}} onClick={() => loadJob(h)}>OPEN</button>
                                    <button style={{...s.btnG(theme.danger), padding:'10px 15px'}} onClick={() => deleteJob(h.id)}>DEL</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* FINANCES */}
                {view === 'FIN' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav />
                        <div style={s.card(theme.fin)}>
                            <h1 style={{color:theme.fin}}>LEDGER</h1>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'30px'}}>
                                <div style={s.displayBox}><span style={s.label}>REVENUE</span><div style={{fontSize:'30px', fontWeight:'900'}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(0)}</div></div>
                                <div style={s.displayBox}><span style={s.label}>EXPENSES</span><div style={{fontSize:'30px', fontWeight:'900', color:theme.danger}}>{job.vault?.expenses?.length || 0}</div></div>
                            </div>
                            <button style={s.btnG(theme.fin)} onClick={downloadCSV}>EXPORT CSV</button>
                            <span style={{...s.label, marginTop:'20px'}}>UPLOAD RECEIPT</span>
                            <input type="file" onChange={(e) => handleFileUpload(e, 'finances', 'expenses')} />
                            <div style={{display:'flex', gap:'10px', overflowX:'auto', marginTop:'20px'}}>
                                {(job.vault?.expenses || []).map((url, i) => <img key={i} src={url} style={{height:'80px', border:'2px solid #444', borderRadius:'8px'}} alt="Receipt" />)}
                            </div>
                        </div>
                    </div>
                )}

                {/* MAIN DOCK */}
                <div className="no-print" style={s.dock}>
                    {['HUB', 'EST', 'SAT', 'RECENT', 'FIN', 'SET'].map(v => (
                        <button key={v} onClick={()=>setView(v)} style={{...s.btnG(view===v?theme.hub:'#222'), minWidth:'80px', flex:1}}>{v}</button>
                    ))}
                    <button style={{...s.btnG(theme.deal), minWidth:'100px'}} onClick={saveMaster}>SAVE</button>
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
