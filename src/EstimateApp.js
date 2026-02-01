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
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '32px', padding: '40px 30px', marginBottom: '35px', border: `2px solid ${theme.border}`, borderTop: `14px solid ${color || theme.hub}`, boxShadow: '0 40px 100px rgba(0,0,0,0.9)' }),
    input: { width: '100%', background: '#000', border: '3px solid #666', color: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', outline: 'none', fontSize: '20px', fontWeight: 'bold', boxSizing: 'border-box' },
    textarea: { width: '100%', background: '#000', border: '3px solid #666', color: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', outline: 'none', fontSize: '16px', fontWeight: 'bold', minHeight: '150px', boxSizing: 'border-box', fontFamily: 'Arial' },
    label: { color: '#94a3b8', fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '10px', display: 'block', letterSpacing: '2px' },
    displayBox: { background: '#050505', padding: '25px', borderRadius: '22px', border: '2px solid #222', marginBottom: '20px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '20px 30px', borderRadius: '20px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', transition: '0.2s', fontSize: '16px', flexShrink: 0 }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '20px', display: 'flex', gap: '15px', overflowX: 'auto', flexWrap: 'nowrap', borderTop: '5px solid #222', zIndex: 1000, paddingRight: '150px' },
    navBar: { display: 'flex', gap: '15px', marginBottom: '40px' },
    traffic: (active, color) => ({ width: '50px', height: '50px', borderRadius: '50%', opacity: active ? 1 : 0.1, border: '4px solid #fff', background: color, cursor: 'pointer' })
};

const NativeSignature = ({ onSave }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const getXY = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const cX = e.clientX || (e.touches && e.touches[0].clientX);
        const cY = e.clientY || (e.touches && e.touches[0].clientY);
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

const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    
    // --- DOCUMENT STATE ---
    const [docType, setDocType] = useState('ESTIMATE'); 
    const [printMode, setPrintMode] = useState('FULL'); 
    
    const [history, setHistory] = useState([]);
    const [vaultSearch, setVaultSearch] = useState('');
    const [clientMatch, setClientMatch] = useState(null);
    
    // --- SETTINGS ---
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
        const saved = localStorage.getItem('mmm_v390_VIEW');
        if (saved) setJob(JSON.parse(saved));
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('mmm_v390_VIEW', JSON.stringify(job)); }, [job]);

    // --- CLIENT RECALL ---
    const checkClientMatch = (name) => {
        if(!name || name.length < 3) { setClientMatch(null); return; }
        const match = history.find(h => h.client?.name?.toLowerCase().includes(name.toLowerCase()));
        if(match) setClientMatch(match.client); else setClientMatch(null);
    };
    const autofillClient = () => { if(clientMatch) { setJob(prev => ({...prev, client: {...prev.client, ...clientMatch}})); setClientMatch(null); } };

    // --- JOB MANAGEMENT ---
    const resetJob = () => {
        if(window.confirm("⚠️ Clear all fields?")) {
            localStorage.removeItem('mmm_v390_VIEW');
            setJob(INITIAL_JOB);
            setClientMatch(null); 
            window.scrollTo(0, 0); 
        }
    };

    const loadJob = (savedJob) => { setJob(savedJob); setView('HUB'); window.scrollTo(0,0); };
    const deleteJob = async (id) => { if(window.confirm("Delete record?")) await deleteDoc(doc(db, 'estimates', id)); };

    // --- MATH ---
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

    // --- STEP 1: PREPARE & VIEW (NO PRINT YET) ---
    const openDocument = async (type, mode = 'FULL') => {
        setDocType(type);
        setPrintMode(mode);
        
        let currentInvoiceNo = job.invoiceNo;
        const today = new Date().toLocaleDateString('en-GB');

        // Only generate number if it's an invoice and doesn't have one
        if (type === 'INVOICE' && !currentInvoiceNo) {
            const nextNum = parseInt(settings.invoiceCount || 1000) + 1;
            currentInvoiceNo = nextNum.toString();
            setJob(prev => ({ ...prev, invoiceNo: currentInvoiceNo, invoiceDate: today }));
            setSettings(prev => ({ ...prev, invoiceCount: nextNum }));
            await setDoc(doc(db, 'settings', 'global'), { ...settings, invoiceCount: nextNum });
            await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, invoiceNo: currentInvoiceNo, invoiceDate: today, totals }, { merge: true });
        }

        // Switch to Preview Mode
        setView('PREVIEW');
        window.scrollTo(0,0);
    };

    // --- STEP 2: TRIGGER PRINT (MANUAL CLICK) ---
    const triggerPrint = () => {
        const filename = `${job.vehicle.reg || 'DOC'}_${job.invoiceNo || 'EST'}_${docType}`;
        document.title = filename;
        window.print(); // DIRECT EXECUTION
        setTimeout(() => document.title = "Triple MMM", 2000);
    };

    // --- CSV EXPORT ---
    const downloadCSV = () => {
        const headers = ["Date", "Invoice #", "Reg", "Client", "Total (£)", "Excess (£)", "Status"];
        const rows = history.map(h => [
            new Date(h.createdAt?.seconds * 1000).toLocaleDateString(),
            h.invoiceNo || '-',
            h.vehicle.reg,
            h.client.name,
            (h.totals?.total || 0).toFixed(2),
            (h.repair?.excess || 0),
            h.status
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `MMM_Tax_Ledger_${new Date().toLocaleDateString()}.csv`); document.body.appendChild(link); link.click();
    };

    // --- DVLA HANDSHAKE ---
    const runDVLA = async () => {
        if (!job?.vehicle?.reg || !settings.dvlaKey) return;
        setLoading(true);
        const cleanReg = job.vehicle.reg.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const proxyUrl = `https://thingproxy.freeboard.io/fetch/${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'x-api-key': settings.dvlaKey.trim(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ registrationNumber: cleanReg })
            });
            if (!response.ok) throw new Error(`Status ${response.status}`);
            const d = await response.json();
            setJob(prev => ({
                ...prev, 
                lastSuccess: new Date().toLocaleString('en-GB'),
                vehicle: {
                    ...prev.vehicle, 
                    make: d.make, year: d.yearOfManufacture, colour: d.colour, fuel: d.fuelType, 
                    engine: d.engineCapacity, mot: d.motStatus, motExpiry: d.motExpiryDate
                }
            }));
        } catch (e) { alert(`Link Failed. Use Manual Entry.`); }
        setLoading(false);
    };

    const saveMaster = async () => {
        await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
        alert("Master File Saved.");
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

    // --- LINE ITEM HANDLERS ---
    const addLineItem = () => setJob(prev => ({ ...prev, repair: { ...prev.repair, items: [...prev.repair.items, { id: Date.now(), desc: '', cost: '' }] } }));
    const updateLineItem = (id, field, value) => setJob(prev => ({ ...prev, repair: { ...prev.repair, items: prev.repair.items.map(item => item.id === id ? { ...item, [field]: value } : item) } }));
    const deleteLineItem = (id) => setJob(prev => ({ ...prev, repair: { ...prev.repair, items: prev.repair.items.filter(item => item.id !== id) } }));

    const HeaderNav = () => (
        <div style={s.navBar} className="no-print">
            <button style={{...s.btnG('#222'), flex:1}} onClick={() => setView('HUB')}>⬅️ BACK TO HUB</button>
        </div>
    );

    // --- PREVIEW SCREEN (DOCUMENT VIEW) ---
    if (view === 'PREVIEW') {
        return (
            <div style={{background:'#fff', minHeight:'100vh', color:'#000', fontFamily:'Arial'}}>
                {/* FLOATING ACTION BAR */}
                <div className="no-print" style={{position:'fixed', top:0, left:0, right:0, background:theme.deal, padding:'20px', zIndex:9999, display:'flex', gap:'10px', boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
                    <button style={{...s.btnG('#fff'), color:'#000', flex:2, fontSize:'24px', fontWeight:'900'}} onClick={triggerPrint}>🖨️ PRINT / PDF</button>
                    <button style={{...s.btnG('#333'), flex:1, fontSize:'20px'}} onClick={() => setView(docType === 'SATISFACTION NOTE' ? 'SAT' : 'EST')}>BACK</button>
                </div>

                <div style={{padding:'120px 40px 40px 40px'}}>
                    {/* DOCUMENT HEADER */}
                    <div style={{display:'flex', justifyContent:'space-between', borderBottom:'8px solid #f97316', paddingBottom:'20px', marginBottom:'20px'}}>
                        <div style={{flex:1}}>
                            {settings.logoUrl && <img src={settings.logoUrl} style={{height:'80px', marginBottom:'10px'}} />}
                            {/* HIDE CO NAME ON JOB CARD */}
                            {docType !== 'JOB CARD' && <h1 style={{margin:0, color:'#f97316', fontSize:'28px'}}>{settings.coName}</h1>}
                            <p style={{fontSize:'12px', lineHeight:'1.4'}}>{settings.address}<br/>{settings.phone}</p>
                        </div>
                        <div style={{textAlign:'right', flex:1}}>
                            <h2 style={{color:'#f97316', fontSize:'40px', margin:0}}>{docType === 'JOB CARD' ? 'WORKSHOP JOB CARD' : printMode === 'EXCESS' ? 'INVOICE (EXCESS)' : docType}</h2>
                            <p style={{fontSize:'16px'}}><strong>Reg:</strong> {job.vehicle.reg}<br/><strong>Date:</strong> {job.invoiceDate || new Date().toLocaleDateString()}</p>
                            
                            {job.invoiceNo && docType === 'INVOICE' && <p style={{fontSize:'16px', color:'#f97316'}}><strong>Inv #: {job.invoiceNo}</strong></p>}
                            
                            {docType === 'JOB CARD' && (
                                <div style={{marginTop:'10px', fontSize:'14px', fontWeight:'bold', border:'1px solid black', padding:'5px'}}>
                                    Mileage: {job.vehicle.mileage || '_______'} | Fuel: {job.vehicle.fuelLevel || '_______'}
                                </div>
                            )}

                            <div style={{marginTop:'15px', fontSize:'12px', borderTop:'2px solid #ddd', paddingTop:'10px'}}>
                                <strong>BILL TO:</strong><br/>
                                {printMode === 'INSURER' ? (
                                    <>
                                        {job.insurance.name || 'Insurance Co.'}<br/>
                                        {job.insurance.address}<br/>
                                        {job.insurance.email}<br/>
                                        Ref: {job.insurance.claim}
                                    </>
                                ) : (
                                    <>
                                        {job.client.name}<br/>
                                        {job.client.address}<br/>
                                        {job.client.email}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* CONTENT SWAP */}
                    {docType === 'SATISFACTION NOTE' ? (
                        <div style={{marginTop:'40px'}}>
                            <h1 style={{color:'#f97316', fontSize:'40px', marginBottom:'30px', textAlign:'center'}}>SATISFACTION NOTE</h1>
                            
                            {/* VEHICLE & CLAIM BOX */}
                            <div style={{border:'2px solid #000', padding:'15px', borderRadius:'10px', marginBottom:'30px', background:'#f8f8f8'}}>
                                <table style={{width:'100%', fontSize:'16px', fontWeight:'bold'}}>
                                    <tbody>
                                        <tr><td style={{padding:'8px', width:'150px'}}>VEHICLE:</td><td>{job.vehicle.make} {job.vehicle.year}</td></tr>
                                        <tr><td style={{padding:'8px'}}>REGISTRATION:</td><td>{job.vehicle.reg}</td></tr>
                                        {job.insurance.claim && <tr><td style={{padding:'8px'}}>CLAIM REF:</td><td>{job.insurance.claim}</td></tr>}
                                    </tbody>
                                </table>
                            </div>

                            <p style={{fontSize:'20px', lineHeight:'1.8', textAlign:'center'}}>
                                I, <strong>{job.client.name}</strong>, hereby confirm that the repairs to the vehicle listed above have been completed to my total satisfaction.
                            </p>
                            <div style={{marginTop:'50px', textAlign:'center'}}>
                                {job.vault.signature && <img src={job.vault.signature} style={{width:'300px', borderBottom:'2px solid black'}} />}
                                <p style={{marginTop:'10px', fontSize:'16px'}}>Signed</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <table style={{width:'100%', marginTop:'10px', borderCollapse:'collapse', fontSize:'12px'}}>
                                <thead><tr style={{background:'#eee', borderBottom:'2px solid #ddd'}}><th style={{padding:'8px', textAlign:'left'}}>Task / Description</th><th style={{padding:'8px', textAlign:'right'}}>{docType === 'JOB CARD' ? 'Check' : 'Amount'}</th></tr></thead>
                                <tbody>
                                    {printMode !== 'EXCESS' && (
                                        <>
                                            {(job.repair.items || []).map((it, i) => (
                                                <tr key={i} style={{borderBottom:'1px solid #eee'}}>
                                                    <td style={{padding:'8px'}}>{it.desc}</td>
                                                    <td style={{textAlign:'right', padding:'8px', fontWeight:'bold'}}>
                                                        {docType === 'JOB CARD' ? '[   ]' : `£${(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}`}
                                                    </td>
                                                </tr>
                                            ))}
                                            
                                            {parseFloat(job.repair.paintMats) > 0 && (
                                                 <tr style={{borderBottom:'1px solid #eee'}}>
                                                     <td style={{padding:'8px'}}>Paint & Materials</td>
                                                     <td style={{textAlign:'right', padding:'8px', fontWeight:'bold'}}>
                                                         {docType === 'JOB CARD' ? '[   ]' : `£${parseFloat(job.repair.paintMats).toFixed(2)}`}
                                                     </td>
                                                 </tr>
                                            )}

                                            <tr>
                                                <td style={{padding:'8px'}}>Qualified Bodywork Labour ({totals.lHrs} hrs)</td>
                                                <td style={{textAlign:'right', padding:'8px', fontWeight:'bold'}}>
                                                    {docType === 'JOB CARD' ? '[   ]' : `£${totals.lPrice.toFixed(2)}`}
                                                </td>
                                            </tr>
                                            
                                            {docType !== 'JOB CARD' && (
                                                <>
                                                    <tr style={{borderTop:'2px solid #777'}}><td style={{padding:'8px', textAlign:'right', fontWeight:'bold'}}>Net Subtotal:</td><td style={{textAlign:'right', padding:'8px'}}>£{(totals.total / (1 + (parseFloat(settings.vatRate)/100))).toFixed(2)}</td></tr>
                                                    <tr><td style={{padding:'8px', textAlign:'right'}}>VAT @ {settings.vatRate}%:</td><td style={{textAlign:'right', padding:'8px'}}>£{(totals.total - (totals.total / (1 + (parseFloat(settings.vatRate)/100)))).toFixed(2)}</td></tr>
                                                </>
                                            )}
                                        </>
                                    )}
                                    {printMode === 'EXCESS' && (
                                        <tr><td style={{padding:'8px'}}>Insurance Excess Contribution</td><td style={{textAlign:'right', padding:'8px', fontWeight:'bold'}}>£{parseFloat(job.repair.excess || 0).toFixed(2)}</td></tr>
                                    )}
                                </tbody>
                            </table>

                            {docType === 'JOB CARD' ? (
                                <div style={{marginTop:'30px', border:'2px dashed #333', padding:'20px'}}>
                                    <h3 style={{marginTop:0}}>INTERNAL TECH NOTES:</h3>
                                    <p style={{fontSize:'16px', whiteSpace:'pre-wrap'}}>{job.repair.techNotes || 'No notes added.'}</p>
                                    <div style={{marginTop:'50px', borderTop:'1px solid black', width:'200px'}}>Quality Checked By</div>
                                </div>
                            ) : (
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'30px'}}>
                                    <div style={{flex:1, textAlign:'center', border:'4px solid #f97316', borderRadius:'20px', padding:'20px', marginRight:'20px'}}>
                                        <div style={{fontSize:'26px', fontWeight:'900', marginBottom:'10px'}}>BACS PAYMENT:<br/>{settings.bank}</div>
                                        {settings.paypalQr && <img src={settings.paypalQr} style={{height:'150px'}} />}
                                    </div>
                                    <div style={{flex:1, textAlign:'right'}}>
                                        <h1 style={{fontSize:'45px', margin:0, color:'#f97316'}}>
                                            £{printMode === 'EXCESS' ? parseFloat(job.repair.excess||0).toFixed(2) : printMode === 'INSURER' ? totals.insurer.toFixed(2) : totals.total.toFixed(2)}
                                        </h1>
                                        {printMode === 'INSURER' && <div style={{marginTop:'5px', color:'#f97316', fontSize:'12px'}}>*Less Client Excess of £{job.repair.excess}</div>}
                                    </div>
                                </div>
                            )}

                            {/* HIDE TERMS ON JOB CARD */}
                            {docType !== 'JOB CARD' && settings.terms && (
                                <div style={{pageBreakBefore: 'always', paddingTop: '20px'}}>
                                    <h2 style={{color:'#f97316', borderBottom:'4px solid #f97316', paddingBottom:'10px', fontSize:'18px', margin:0}}>TERMS & CONDITIONS</h2>
                                    <div style={{columnCount: 2, columnGap: '30px', fontSize:'10px', lineHeight:'1.4', marginTop:'15px', whiteSpace: 'pre-wrap'}}>
                                        {settings.terms}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; overflow: visible !important; } @page { margin: 10mm; } }`}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
