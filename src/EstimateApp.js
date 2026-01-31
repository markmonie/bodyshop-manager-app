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

// --- THEME: TITAN TUNGSTEN ---
const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', fin: '#8b5cf6', bg: '#000', card: '#111', text: '#f8fafc', border: '#333', danger: '#ef4444' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '32px', padding: '40px 30px', marginBottom: '35px', border: `2px solid ${theme.border}`, borderTop: `14px solid ${color || theme.hub}`, boxShadow: '0 40px 100px rgba(0,0,0,0.9)' }),
    input: { width: '100%', background: '#000', border: '1px solid #444', color: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', outline: 'none', fontSize: '20px', fontWeight: 'bold', boxSizing: 'border-box' },
    textarea: { width: '100%', background: '#000', border: '1px solid #444', color: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', outline: 'none', fontSize: '16px', fontWeight: 'bold', minHeight: '150px', boxSizing: 'border-box', fontFamily: 'Arial' },
    label: { color: '#94a3b8', fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '10px', display: 'block', letterSpacing: '2px' },
    displayBox: { background: '#050505', padding: '25px', borderRadius: '22px', border: '2px solid #222', marginBottom: '20px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '20px 30px', borderRadius: '20px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', transition: '0.2s', fontSize: '16px', flexShrink: 0 }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '20px', display: 'flex', gap: '15px', overflowX: 'auto', flexWrap: 'nowrap', borderTop: '5px solid #222', zIndex: 1000, paddingRight: '150px' },
    navBar: { display: 'flex', gap: '15px', marginBottom: '40px' },
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
    const [docType, setDocType] = useState('ESTIMATE'); 
    const [printMode, setPrintMode] = useState('FULL'); 
    const [history, setHistory] = useState([]);
    const [clientMatch, setClientMatch] = useState(null);
    const [vaultSearch, setVaultSearch] = useState('');
    
    // --- SETTINGS ---
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: 'Sort Code: 80-22-60 | Acc: 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'LXqv1yDD1IatEPHlntk2w8MEuz9X57lE9TP9sxGc', 
        logoUrl: '', paypalQr: '',
        terms: 'TERMS & CONDITIONS\n\n1. Payment due on completion.\n2. Vehicles left at owner risk.',
        invoiceCount: 1000 
    });

    // --- JOB FACTORY ---
    const getEmptyJob = () => ({
        status: 'STRIPPING', lastSuccess: '', invoiceNo: '', invoiceDate: '',
        client: { name: '', address: '', phone: '', email: '', claim: '' },
        insurance: { name: '', address: '', phone: '', email: '', claim: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', colour: '', fuel: '', engine: '', mot: '', motExpiry: '', mileage: '', fuelLevel: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0', techNotes: '' },
        vault: { signature: '', expenses: [] }
    });

    const [job, setJob] = useState(getEmptyJob());

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const saved = localStorage.getItem('mmm_v230_PLATINUM');
        if (saved) setJob(JSON.parse(saved));
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('mmm_v230_PLATINUM', JSON.stringify(job)); }, [job]);

    // --- CLIENT RECALL ---
    const checkClientMatch = (name) => {
        if(!name || name.length < 3) { setClientMatch(null); return; }
        const match = history.find(h => h.client?.name?.toLowerCase().includes(name.toLowerCase()));
        if(match) setClientMatch(match.client); else setClientMatch(null);
    };
    const autofillClient = () => { if(clientMatch) { setJob(prev => ({...prev, client: {...prev.client, ...clientMatch}})); setClientMatch(null); } };

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

    // --- ACTIONS ---
    const handlePrint = async (type, mode = 'FULL') => {
        setDocType(type);
        setPrintMode(mode);
        let currentInvoiceNo = job.invoiceNo;
        // Auto-assign invoice number ONLY for INVOICES (not Estimates)
        if (type === 'INVOICE' && !currentInvoiceNo) {
            const nextNum = parseInt(settings.invoiceCount || 1000) + 1;
            currentInvoiceNo = nextNum.toString();
            const today = new Date().toLocaleDateString('en-GB');
            setJob(prev => ({ ...prev, invoiceNo: currentInvoiceNo, invoiceDate: today }));
            setSettings(prev => ({ ...prev, invoiceCount: nextNum }));
            await setDoc(doc(db, 'settings', 'global'), { ...settings, invoiceCount: nextNum });
            await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, invoiceNo: currentInvoiceNo, invoiceDate: today, totals }, { merge: true });
        }
        
        const filename = `${job.vehicle.reg || 'DOC'}_${currentInvoiceNo || 'EST'}_${type}`;
        document.title = filename;
        setTimeout(() => { window.print(); setTimeout(() => document.title = "Triple MMM", 2000); }, 500);
    };

    const downloadCSV = () => {
        const headers = ["Date", "Invoice #", "Reg", "Client", "Total (£)", "Excess (£)", "Status"];
        const rows = history.map(h => [ new Date(h.createdAt?.seconds * 1000).toLocaleDateString(), h.invoiceNo || '-', h.vehicle.reg, h.client.name, (h.totals?.total || 0).toFixed(2), (h.repair?.excess || 0), h.status ]);
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `MMM_Tax_Ledger_${new Date().toLocaleDateString()}.csv`); document.body.appendChild(link); link.click();
    };

    const resetJob = () => {
        if(window.confirm("⚠️ Clear all fields? Any unsaved data will be lost.")) {
            localStorage.removeItem('mmm_v230_PLATINUM');
            setJob(getEmptyJob());
            setClientMatch(null); 
            window.scrollTo(0, 0); 
        }
    };

    const loadJob = (savedJob) => {
        setJob(savedJob);
        setView('HUB');
        window.scrollTo(0,0);
    };

    const deleteJob = async (id) => {
        if(window.confirm("Permanently delete this record?")) {
            await deleteDoc(doc(db, 'estimates', id));
        }
    };

    // --- DVLA HANDSHAKE ---
    const runDVLA = async () => {
        if (!job?.vehicle?.reg) { alert("Please enter a Registration Number."); return; }
        setLoading(true);
        const cleanReg = job.vehicle.reg.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const url = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
        const apiKey = 'LXqv1yDD1IatEPHlntk2w8MEuz9X57lE9TP9sxGc';
        try {
            const response = await fetch(url, {
                method: 'POST', headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ registrationNumber: cleanReg })
            });
            if (!response.ok) throw new Error(`Direct Connection Failed (Status: ${response.status})`);
            const d = await response.json();
            setJob(prev => ({
                ...prev, lastSuccess: new Date().toLocaleString('en-GB'),
                vehicle: { ...prev.vehicle, make: d.make, year: d.yearOfManufacture, colour: d.colour, fuel: d.fuelType, engine: d.engineCapacity, mot: d.motStatus, motExpiry: d.motExpiryDate }
            }));
            alert("Vehicle Found!"); 
        } catch (e) { console.error(e); alert(`Link Failed: ${e.message}`); }
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

    // --- LIST HANDLERS ---
    const addLineItem = () => setJob(prev => ({ ...prev, repair: { ...prev.repair, items: [...prev.repair.items, { id: Date.now(), desc: '', cost: '' }] } }));
    const updateLineItem = (id, field, value) => setJob(prev => ({ ...prev, repair: { ...prev.repair, items: prev.repair.items.map(item => item.id === id ? { ...item, [field]: value } : item) } }));
    const deleteLineItem = (id) => setJob(prev => ({ ...prev, repair: { ...prev.repair, items: prev.repair.items.filter(item => item.id !== id) } }));

    const HeaderNav = () => (
        <div style={s.navBar} className="no-print">
            <button style={{...s.btnG('#222'), flex:1}} onClick={() => setView('HUB')}>⬅️ BACK TO HUB</button>
        </div>
    );

    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '180px' }}>
            <div className="no-print">
                {/* HUB */}
                {view === 'HUB' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                            <h1 style={{color:theme.hub, fontSize:'65px', letterSpacing:'-4px', margin:0}}>COMMAND HUB</h1>
                            <button style={{...s.btnG('#333'), padding:'15px'}} onClick={resetJob}>+ NEW JOB</button>
                        </div>
                        
                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>Technical ID</span>
                            <div style={{display:'flex', gap:'12px', marginBottom:'20px'}}>
                                <input style={{...s.input, flex:4, fontSize:'55px', textAlign:'center', border:`5px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                                {/* DVLA BUTTON HIDDEN (MANUAL MODE) */}
                                {/* <button style={{...s.btnG(theme.hub), flex:1, fontSize:'20px'}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button> */}
                            </div>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                                <div><span style={s.label}>MAKE</span><input style={s.input} value={job.vehicle.make} onChange={e=>setJob({...job, vehicle:{...job.vehicle, make:e.target.value}})} /></div>
                                <div><span style={s.label}>MODEL / SPEC</span><input style={s.input} value={job.vehicle.year} onChange={e=>setJob({...job, vehicle:{...job.vehicle, year:e.target.value}})} /></div>
                                <div><span style={s.label}>COLOUR</span><input style={s.input} value={job.vehicle.colour} onChange={e=>setJob({...job, vehicle:{...job.vehicle, colour:e.target.value}})} /></div>
                                <div><span style={s.label}>VIN / CHASSIS</span><input style={s.input} value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} /></div>
                                {/* NEW LIABILITY FIELDS */}
                                <div><span style={s.label}>MILEAGE (Miles)</span><input style={s.input} value={job.vehicle.mileage} onChange={e=>setJob({...job, vehicle:{...job.vehicle, mileage:e.target.value}})} /></div>
                                <div><span style={s.label}>FUEL LEVEL</span><input style={s.input} value={job.vehicle.fuelLevel} onChange={e=>setJob({...job, vehicle:{...job.vehicle, fuelLevel:e.target.value}})} placeholder="e.g. 1/4 Tank" /></div>
                            </div>
                        </div>

                        <div style={s.card(theme.deal)}>
                            <span style={s.label}>Station 3: Stakeholders</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                                <div>
                                    <span style={{...s.label, color:theme.deal}}>CLIENT DETAILS</span>
                                    <input style={s.input} placeholder="Name (Search)" value={job.client.name} onChange={e => { const val = e.target.value; setJob({...job, client:{...job.client, name:val}}); checkClientMatch(val); }} />
                                    {clientMatch && ( <div style={{background:'#111', border:`1px solid ${theme.deal}`, padding:'10px', borderRadius:'10px', marginBottom:'15px', cursor:'pointer'}} onClick={autofillClient}><span style={{color:theme.deal, fontWeight:'bold'}}>✨ FOUND PREVIOUS CLIENT:</span><br/>{clientMatch.name}<br/><small style={{textDecoration:'underline'}}>Click to Auto-fill</small></div> )}
                                    <input style={s.input} placeholder="Address" value={job.client.address} onChange={e=>setJob({...job, client:{...job.client, address:e.target.value}})} />
                                    <input style={s.input} placeholder="Phone" value={job.client.phone} onChange={e=>setJob({...job, client:{...job.client, phone:e.target.value}})} />
                                    <input style={s.input} placeholder="Email" value={job.client.email} onChange={e=>setJob({...job, client:{...job.client, email:e.target.value}})} />
                                </div>
                                <div>
                                    <span style={{...s.label, color:theme.set}}>INSURANCE DETAILS</span>
                                    <input style={s.input} placeholder="Company Name" value={job.insurance.name} onChange={e=>setJob({...job, insurance:{...job.insurance, name:e.target.value}})} />
                                    <input style={s.input} placeholder="Address" value={job.insurance.address} onChange={e=>setJob({...job, insurance:{...job.insurance, address:e.target.value}})} />
                                    <input style={s.input} placeholder="Phone" value={job.insurance.phone} onChange={e=>setJob({...job, insurance:{...job.insurance, phone:e.target.value}})} />
                                    <input style={s.input} placeholder="Insurance Email" value={job.insurance.email} onChange={e=>setJob({...job, insurance:{...job.insurance, email:e.target.value}})} />
                                    <input style={s.input} placeholder="Claim #" value={job.insurance.claim} onChange={e=>setJob({...job, insurance:{...job.insurance, claim:e.target.value}})} />
                                </div>
                            </div>
                        </div>

                        <div style={s.card(theme.work)}>
                            <span style={s.label}>Station 4: AI Shop Intelligence</span>
                            <div style={s.displayBox}><span style={s.label}>PROBABLE READY DATE</span><div style={{color:theme.hub, fontSize:'45px', fontWeight:'900'}}>{projectedDate}</div></div>
                            <button style={{...s.btnG(theme.deal), width:'100%', padding:'35px', fontSize:'32px'}} onClick={()=>setView('EST')}>OPEN ESTIMATOR</button>
                        </div>
                        
                        <button style={{...s.btnG(theme.danger), width:'100%', marginTop:'20px', padding:'25px', fontSize:'20px'}} onClick={resetJob}>⚠️ CLEAR ALL FIELDS</button>
                    </div>
                )}

                {/* ESTIMATOR */}
                {view === 'EST' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav />
                        <div style={s.card(theme.work)}>
                            <span style={s.label}>Qualified Labour Hours</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'15px', marginBottom:'35px'}}>
                                <div><span style={s.label}>MET</span><input style={s.input} value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} /></div>
                                <div><span style={s.label}>PANEL</span><input style={s.input} value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} /></div>
                                <div><span style={s.label}>PAINT</span><input style={s.input} value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} /></div>
                            </div>
                            
                            <span style={s.label}>PAINT & MATERIALS (£)</span>
                            <input style={{...s.input, border:`3px solid ${theme.work}`}} value={job.repair.paintMats} onChange={e=>setJob({...job, repair:{...job.repair, paintMats:e.target.value}})} placeholder="0.00" />

                            <span style={{...s.label, marginTop:'20px'}}>Parts / Line Items</span>
                            {job.repair.items.map((it) => (
                                <div key={it.id} style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                                    <input style={{...s.input, flex:3, marginBottom:0}} value={it.desc} placeholder="Item Description" onChange={(e) => updateLineItem(it.id, 'desc', e.target.value)} />
                                    <input style={{...s.input, flex:1, marginBottom:0}} value={it.cost} placeholder="£" onChange={(e) => updateLineItem(it.id, 'cost', e.target.value)} />
                                    <button style={{...s.btnG(theme.danger), padding:'15px'}} onClick={() => deleteLineItem(it.id)}>X</button>
                                </div>
                            ))}
                            <button style={{...s.btnG(theme.work), width:'100%'}} onClick={addLineItem}>+ ADD LINE ITEM</button>
                        </div>
                        <div style={s.card(theme.deal)}>
                            <h2 style={{fontSize:'45px', textAlign:'right'}}>TOTAL: £{totals.total.toFixed(2)}</h2>
                            <span style={{...s.label, color:theme.danger}}>INSURANCE EXCESS CONTRIBUTION</span>
                            <input style={{...s.input, color:theme.danger, border:`4px solid ${theme.danger}`}} placeholder="EXCESS -£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                            
                            <span style={s.label}>INVOICE DATE</span>
                            <input style={s.input} value={job.invoiceDate} onChange={e=>setJob({...job, invoiceDate:e.target.value})} placeholder="DD/MM/YYYY" />

                            <span style={s.label}>PRINT OPTIONS</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'10px'}}>
                                <button style={{...s.btnG('#333'), fontSize:'12px'}} onClick={() => handlePrint('INVOICE', 'FULL')}>FULL INVOICE</button>
                                <button style={{...s.btnG(theme.deal), fontSize:'12px'}} onClick={() => handlePrint('INVOICE', 'INSURER')}>INSURER (NET)</button>
                                <button style={{...s.btnG(theme.danger), fontSize:'12px'}} onClick={() => handlePrint('INVOICE', 'EXCESS')}>CUSTOMER EXCESS</button>
                            </div>
                            {/* V4.2: DEDICATED ESTIMATE BUTTON */}
                            <button style={{...s.btnG(theme.work), width:'100%', marginTop:'10px'}} onClick={() => handlePrint('ESTIMATE', 'FULL')}>PRINT ESTIMATE</button>
                        </div>
                    </div>
                )}

                {/* SATISFACTION NOTE */}
                {view === 'SAT' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav />
                        <div style={s.card(theme.deal)}>
                            <h1 style={{textAlign:'center', color:theme.deal}}>SATISFACTION NOTE</h1>
                            <div style={{marginBottom:'30px', fontSize:'18px', lineHeight:'1.6'}}>
                                <p>I hereby confirm that the repairs to vehicle <strong>{job.vehicle.reg}</strong> have been completed to my total satisfaction.</p>
                                <p><strong>Client:</strong> {job.client.name}<br/><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                            </div>
                            <NativeSignature onSave={(sig) => setJob({...job, vault: {...job.vault, signature: sig}})} />
                            <button style={{...s.btnG(theme.deal), width:'100%'}} onClick={() => handlePrint('SATISFACTION NOTE', 'FULL')}>PRINT NOTE</button>
                        </div>
                    </div>
                )}

                {/* SETTINGS */}
                {view === 'SET' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav />
                        <div style={s.card(theme.set)}>
                            <span style={s.label}>Enterprise Settings</span>
                            <input style={s.input} placeholder="Business Name" value={settings.coName} onChange={e=>setSettings({...settings, coName:e.target.value})} />
                            <input style={s.input} placeholder="Bank Sort/Acc" value={settings.bank} onChange={e=>setSettings({...settings, bank:e.target.value})} />
                            <input style={s.input} placeholder="DVLA API Key" value={settings.dvlaKey} onChange={e=>setSettings({...settings, dvlaKey:e.target.value})} />
                            
                            <span style={s.label}>Financial Variables</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'15px'}}>
                                <div><span style={s.label}>Markup (%)</span><input style={s.input} value={settings.markup} onChange={e=>setSettings({...settings, markup:e.target.value})} /></div>
                                <div><span style={s.label}>Labour (£/hr)</span><input style={s.input} value={settings.labourRate} onChange={e=>setSettings({...settings, labourRate:e.target.value})} /></div>
                                <div><span style={s.label}>VAT (%)</span><input style={s.input} value={settings.vatRate} onChange={e=>setSettings({...settings, vatRate:e.target.value})} /></div>
                            </div>

                            <span style={s.label}>Start Invoice Numbering At:</span>
                            <input style={s.input} type="number" value={settings.invoiceCount} onChange={e=>setSettings({...settings, invoiceCount:e.target.value})} />
                            <span style={s.label}>Company Logo</span>
                            <input type="file" onChange={(e) => handleFileUpload(e, 'branding', 'logoUrl')} style={{marginBottom:'20px', color:'#fff'}} />
                            {settings.logoUrl && <img src={settings.logoUrl} style={{height:'100px', display:'block', marginBottom:'20px'}} />}
                            <span style={s.label}>PayPal QR Code</span>
                            <input type="file" onChange={(e) => handleFileUpload(e, 'branding', 'paypalQr')} style={{marginBottom:'20px', color:'#fff'}} />
                            {settings.paypalQr && <img src={settings.paypalQr} style={{height:'100px', display:'block', marginBottom:'20px'}} />}
                            <span style={s.label}>Terms & Conditions (Auto-Attaches)</span>
                            <textarea style={s.textarea} value={settings.terms} onChange={e=>setSettings({...settings, terms:e.target.value})} placeholder="Enter T&Cs here..." />
                            <button style={{...s.btnG(theme.deal), width:'100%', padding:'35px'}} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Settings Locked."); }}>SAVE GLOBAL SETTINGS</button>
                        </div>
                    </div>
                )}

                {/* JOB HISTORY / RECENT */}
                {view === 'RECENT' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav />
                        <h1 style={{color:theme.hub, marginBottom:'30px'}}>JOB VAULT</h1>
                        <div style={{marginBottom:'30px'}}><span style={s.label}>SEARCH ARCHIVE</span><input style={s.input} placeholder="Search Reg or Name..." value={vaultSearch} onChange={(e) => setVaultSearch(e.target.value)}/></div>
                        {history.filter(h => {
                                const term = vaultSearch.toUpperCase();
                                const reg = (h.vehicle?.reg || '').toUpperCase();
                                const client = (h.client?.name || '').toUpperCase();
                                return reg.includes(term) || client.includes(term);
                            }).map((h) => (
                            <div key={h.id} style={{...s.card('#333'), display:'flex', justifyContent:'space-between', alignItems:'center', padding:'25px'}}>
                                <div>
                                    <h2 style={{margin:0, color:theme.hub}}>{h.vehicle?.reg || 'UNKNOWN'}</h2>
                                    <p style={{margin:0, color:'#888'}}>{h.client?.name} | {new Date(h.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                                    <p style={{margin:0, fontSize:'14px'}}>£{(h.totals?.total || 0).toFixed(2)}</p>
                                </div>
                                <div style={{display:'flex', gap:'10px'}}>
                                    <button style={{...s.btnG(theme.deal), padding:'10px 20px', fontSize:'14px'}} onClick={() => loadJob(h)}>OPEN</button>
                                    <button style={{...s.btnG(theme.danger), padding:'10px 20px', fontSize:'14px'}} onClick={() => deleteJob(h.id)}>DEL</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* FINANCE VAULT (WITH CSV EXPORT) */}
                {view === 'FIN' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav />
                        <div style={s.card(theme.fin)}>
                            <h1 style={{color:theme.fin, marginBottom:'30px'}}>FINANCE CSR VAULT</h1>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'30px', marginBottom:'40px'}}>
                                <div style={{...s.displayBox, background:'#000'}}><span style={s.label}>REVENUE</span><div style={{fontSize:'40px', fontWeight:'900'}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(0)}</div></div>
                                <div style={{...s.displayBox, background:'#000'}}><span style={s.label}>RECEIPTS</span><div style={{fontSize:'40px', fontWeight:'900', color:theme.danger}}>{job.vault?.expenses?.length || 0}</div></div>
                            </div>
                            <button style={{...s.btnG(theme.fin), width:'100%', marginBottom:'30px'}} onClick={downloadCSV}>DOWNLOAD TAX LEDGER (CSV)</button>
                            <span style={s.label}>Upload Receipt</span>
                            <input type="file" onChange={(e) => handleFileUpload(e, 'finances', 'expenses')} style={{marginBottom:'20px'}} />
                            <div style={{display:'flex', gap:'10px', overflowX:'auto'}}>
                                {(job.vault?.expenses || []).map((url, i) => <img key={i} src={url} style={{height:'100px', border:'2px solid #333'}} />)}
                            </div>
                        </div>
                    </div>
                )}

                {/* DOCK */}
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

            {/* PRINT ENGINE */}
            <div className="print-only" style={{display:'none', color:'black', padding:'50px', fontFamily:'Arial', width:'100%', boxSizing:'border-box'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'8px solid #f97316', paddingBottom:'35px'}}>
                    <div style={{flex:1}}>
                        {settings.logoUrl && <img src={settings.logoUrl} style={{height:'80px', marginBottom:'15px'}} />}
                        <h1 style={{margin:0, color:'#f97316', fontSize:'40px'}}>{settings.coName}</h1>
                        <p style={{fontSize:'16px'}}>{settings.address}<br/>{settings.phone}</p>
                    </div>
                    <div style={{textAlign:'right', flex:1}}>
                        <h2 style={{color:'#f97316', fontSize:'60px', margin:0}}>{printMode === 'EXCESS' ? 'INVOICE (EXCESS)' : docType}</h2>
                        <p style={{fontSize:'20px'}}><strong>Reg:</strong> {job.vehicle.reg}<br/><strong>Date:</strong> {job.invoiceDate || new Date().toLocaleDateString()}</p>
                        {job.invoiceNo && docType === 'INVOICE' && <p style={{fontSize:'20px', color:'#f97316'}}><strong>Inv #: {job.invoiceNo}</strong></p>}
                        
                        <div style={{marginTop:'20px', fontSize:'16px', borderTop:'2px solid #ddd', paddingTop:'10px'}}>
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

                {docType === 'SATISFACTION NOTE' ? (
                    <div style={{marginTop:'60px', textAlign:'center'}}>
                        <h1 style={{color:'#f97316', fontSize:'50px', marginBottom:'40px'}}>SATISFACTION NOTE</h1>
                        <p style={{fontSize:'24px', lineHeight:'2'}}>I, <strong>{job.client.name}</strong>, confirm that the repairs to vehicle <strong>{job.vehicle.reg}</strong> have been completed to my total satisfaction.</p>
                        {job.vault.signature && <img src={job.vault.signature} style={{width:'400px', marginTop:'50px', borderBottom:'2px solid black'}} />}
                        <p style={{marginTop:'10px', fontSize:'18px'}}>Signed</p>
                    </div>
                ) : (
                    <>
                        <table style={{width:'100%', marginTop:'40px', borderCollapse:'collapse'}}>
                            <thead><tr style={{background:'#eee', borderBottom:'4px solid #ddd'}}><th style={{padding:'20px', textAlign:'left'}}>Description</th><th style={{padding:'20px', textAlign:'right'}}>Amount</th></tr></thead>
                            <tbody>
                                {printMode !== 'EXCESS' && (
                                    <>
                                        {(job.repair.items || []).map((it, i) => (<tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'15px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'15px', fontWeight:'bold'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>))}
                                        
                                        {parseFloat(job.repair.paintMats) > 0 && (
                                             <tr style={{borderBottom:'1px solid #eee'}}><td style={{padding:'15px'}}>Paint & Materials</td><td style={{textAlign:'right', padding:'15px', fontWeight:'bold'}}>£{parseFloat(job.repair.paintMats).toFixed(2)}</td></tr>
                                        )}

                                        <tr><td style={{padding:'15px'}}>Qualified Bodywork Labour ({totals.lHrs} hrs)</td><td style={{textAlign:'right', padding:'15px', fontWeight:'bold'}}>£{totals.lPrice.toFixed(2)}</td></tr>
                                        
                                        <tr style={{borderTop:'2px solid #777'}}><td style={{padding:'15px', textAlign:'right', fontWeight:'bold'}}>Net Subtotal:</td><td style={{textAlign:'right', padding:'15px'}}>£{(totals.total / (1 + (parseFloat(settings.vatRate)/100))).toFixed(2)}</td></tr>
                                        <tr><td style={{padding:'15px', textAlign:'right'}}>VAT @ {settings.vatRate}%:</td><td style={{textAlign:'right', padding:'15px'}}>£{(totals.total - (totals.total / (1 + (parseFloat(settings.vatRate)/100)))).toFixed(2)}</td></tr>
                                    </>
                                )}
                                {printMode === 'EXCESS' && (
                                    <tr><td style={{padding:'15px'}}>Insurance Excess Contribution</td><td style={{textAlign:'right', padding:'15px', fontWeight:'bold'}}>£{parseFloat(job.repair.excess || 0).toFixed(2)}</td></tr>
                                )}
                            </tbody>
                        </table>

                        <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:'40px', marginTop:'60px'}}>
                            {/* V4.2: SUPER-SIZED PAYMENT BOX */}
                            <div style={{textAlign:'center', border:'4px solid #f97316', borderRadius:'25px', padding:'30px'}}>
                                <div style={{fontSize:'26px', fontWeight:'900', marginBottom:'20px'}}>BACS PAYMENT: {settings.bank}</div>
                                {settings.paypalQr && <img src={settings.paypalQr} style={{height:'180px'}} />}
                            </div>
                            <div style={{textAlign:'right'}}>
                                <h1 style={{fontSize:'75px', margin:0, color:'#f97316'}}>
                                    £{printMode === 'EXCESS' ? parseFloat(job.repair.excess||0).toFixed(2) : printMode === 'INSURER' ? totals.insurer.toFixed(2) : totals.total.toFixed(2)}
                                </h1>
                                {printMode === 'INSURER' && <div style={{marginTop:'10px', color:'#f97316'}}>*Less Client Excess of £{job.repair.excess}</div>}
                            </div>
                        </div>

                        {settings.terms && (
                            <div style={{pageBreakBefore: 'always', paddingTop: '50px'}}>
                                <h2 style={{color:'#f97316', borderBottom:'4px solid #f97316', paddingBottom:'10px'}}>TERMS & CONDITIONS</h2>
                                <p style={{whiteSpace: 'pre-wrap', fontSize:'14px', lineHeight:'1.5', marginTop:'20px'}}>{settings.terms}</p>
                            </div>
                        )}
                    </>
                )}
            </div>
            <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; overflow: visible !important; } }`}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
