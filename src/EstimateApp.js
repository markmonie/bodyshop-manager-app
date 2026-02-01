import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc, deleteDoc, addDoc } from 'firebase/firestore';
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
    card: (color) => ({ background: theme.card, borderRadius: '32px', padding: '30px 20px', marginBottom: '35px', border: `2px solid ${theme.border}`, borderTop: `14px solid ${color || theme.hub}`, boxShadow: '0 40px 100px rgba(0,0,0,0.9)', position: 'relative' }),
    input: { width: '100%', background: '#000', border: '3px solid #666', color: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', outline: 'none', fontSize: '20px', fontWeight: 'bold', boxSizing: 'border-box' },
    textarea: { width: '100%', background: '#000', border: '3px solid #666', color: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', outline: 'none', fontSize: '16px', fontWeight: 'bold', minHeight: '150px', boxSizing: 'border-box', fontFamily: 'Arial' },
    label: { color: '#94a3b8', fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '10px', display: 'block', letterSpacing: '2px' },
    displayBox: { background: '#050505', padding: '25px', borderRadius: '22px', border: '2px solid #222', marginBottom: '20px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '20px 30px', borderRadius: '20px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', transition: '0.1s', fontSize: '16px', flexShrink: 0, userSelect: 'none', touchAction: 'manipulation' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '20px', display: 'flex', gap: '15px', overflowX: 'auto', flexWrap: 'nowrap', borderTop: '5px solid #222', zIndex: 1000, paddingRight: '150px' },
    navBar: { display: 'flex', gap: '15px', marginBottom: '40px' },
    loader: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, fontSize: '30px', flexDirection: 'column' }
};

// --- SAFETY HELPER (PREVENTS CRASHES) ---
const safeFloat = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
};

// --- COMPONENT: SIGNATURE PAD ---
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

// --- MAIN APPLICATION ---
const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    const [docType, setDocType] = useState('ESTIMATE'); 
    const [printMode, setPrintMode] = useState('FULL'); 
    
    // DATA STREAMS
    const [history, setHistory] = useState([]); // Income (Jobs)
    const [expenses, setExpenses] = useState([]); // Expenditure (Receipts)
    
    // UI STATE
    const [vaultSearch, setVaultSearch] = useState('');
    const [clientMatch, setClientMatch] = useState(null);
    
    // NEW EXPENSE INPUT
    const [exVendor, setExVendor] = useState('');
    const [exCost, setExCost] = useState('');
    const [exDesc, setExDesc] = useState('');
    const [exDate, setExDate] = useState(new Date().toISOString().split('T')[0]);
    const [exFile, setExFile] = useState(null);

    // SETTINGS (DVLA KEY BAKED IN)
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
        const saved = localStorage.getItem('mmm_v690_FINAL');
        if (saved) setJob(JSON.parse(saved));
        
        // STREAM 1: INCOME (ESTIMATES)
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), 
            (snap) => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))),
            (err) => console.log("Est Error", err)
        );

        // STREAM 2: EXPENDITURE (EXPENSES)
        onSnapshot(collection(db, 'expenses'), 
            (snap) => {
                const loaded = snap.docs.map(d => ({id:d.id, ...d.data()}));
                loaded.sort((a,b) => (b.date > a.date ? 1 : -1));
                setExpenses(loaded);
            },
            (err) => console.log("Exp Error", err)
        );
    }, []);

    useEffect(() => { localStorage.setItem('mmm_v690_FINAL', JSON.stringify(job)); }, [job]);

    // --- FINANCIAL CALCULATIONS (CRASH PROOF) ---
    const financialStats = useMemo(() => {
        let income = 0;
        let expense = 0;

        // Sum Income (Only jobs with Invoice Numbers count as "Real" income, optional logic, usually total is fine)
        history.forEach(h => {
            income += safeFloat(h.totals?.total);
        });

        // Sum Expenses
        expenses.forEach(e => {
            expense += safeFloat(e.cost);
        });

        return { income, expense, profit: income - expense };
    }, [history, expenses]);

    // --- JOB TOTALS ---
    const totals = useMemo(() => {
        const pCost = (job.repair.items || []).reduce((a, b) => a + safeFloat(b.cost), 0);
        const pPrice = pCost * (1 + (safeFloat(settings.markup) / 100));
        const lHrs = safeFloat(job.repair.panelHrs) + safeFloat(job.repair.paintHrs) + safeFloat(job.repair.metHrs);
        const lPrice = lHrs * safeFloat(settings.labourRate);
        const subtotal = pPrice + lPrice + safeFloat(job.repair.paintMats);
        const total = subtotal * (1 + (safeFloat(settings.vatRate) / 100));
        return { total, insurer: (total - safeFloat(job.repair.excess)), lHrs, lPrice };
    }, [job.repair, settings]);

    // --- ACTIONS ---
    const handleExpenseUpload = async (e) => {
        const file = e.target.files[0];
        if (file) setExFile(file);
    };

    const saveExpense = async () => {
        if (!exVendor || !exCost) return alert("Vendor and Cost required.");
        setLoading(true);
        let evidenceUrl = '';
        
        if (exFile) {
            try {
                const r = ref(storage, `receipts/${Date.now()}_${exFile.name}`);
                await uploadBytes(r, exFile);
                evidenceUrl = await getDownloadURL(r);
            } catch(e) { console.log("Upload failed"); }
        }

        await addDoc(collection(db, 'expenses'), {
            vendor: exVendor,
            cost: exCost,
            desc: exDesc,
            date: exDate,
            evidenceUrl,
            createdAt: serverTimestamp()
        });

        // Reset Form
        setExVendor(''); setExCost(''); setExDesc(''); setExFile(null);
        setLoading(false);
    };

    const deleteExpense = async (id) => {
        if(window.confirm("Delete this expense entry?")) await deleteDoc(doc(db, 'expenses', id));
    };

    const generateLedgerCSV = () => {
        const rows = [["TYPE", "DATE", "ENTITY", "DESCRIPTION", "AMOUNT (£)", "VAT (£)"]];
        
        // Add Income
        history.forEach(h => {
            const tot = safeFloat(h.totals?.total);
            const vat = tot - (tot / (1 + (safeFloat(settings.vatRate)/100)));
            rows.push(["INCOME", new Date(h.createdAt?.seconds*1000).toLocaleDateString(), h.client?.name || 'Client', h.vehicle?.reg || 'Job', tot.toFixed(2), vat.toFixed(2)]);
        });

        // Add Expenses
        expenses.forEach(e => {
            rows.push(["EXPENSE", e.date, e.vendor, e.desc, `-${safeFloat(e.cost).toFixed(2)}`, "0.00"]);
        });

        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "MMM_Financial_Ledger.csv");
        document.body.appendChild(link);
        link.click();
    };

    const runDVLA = async () => {
        if (!job?.vehicle?.reg || !settings.dvlaKey) { alert("Check Reg & Key"); return; }
        setLoading(true);
        const cleanReg = job.vehicle.reg.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles');

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'x-api-key': settings.dvlaKey.trim(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ registrationNumber: cleanReg })
            });
            if (response.ok) { 
                const data = await response.json();
                setJob(prev => ({
                    ...prev, vehicle: { ...prev.vehicle, make: data.make, year: data.yearOfManufacture, colour: data.colour, fuel: data.fuelType, engine: data.engineCapacity, mot: data.motStatus, motExpiry: data.motExpiryDate }
                }));
            } else { throw new Error("API Rejected"); }
        } catch (e) { alert("⚠️ Network Blocked Lookup.\nPlease enter Vehicle Make/Model manually."); }
        setLoading(false);
    };

    const openDocument = (type, mode = 'FULL') => {
        setDocType(type); setPrintMode(mode); setView('PREVIEW'); window.scrollTo(0,0);
    };

    const handleBrandingUpload = async (e, field) => {
        const file = e.target.files[0]; if(!file) return;
        setLoading(true);
        const r = ref(storage, `branding/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        setSettings(prev => ({...prev, [field]: url}));
        setLoading(false);
    };

    // --- RENDER ---
    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '180px', fontFamily: 'Arial, sans-serif' }}>
            {loading && <LoadingOverlay />}
            
            {/* VIEW: HUB */}
            {view === 'HUB' && (
                <div style={{maxWidth:'850px', margin:'0 auto'}}>
                    <h1 style={{color:theme.hub, fontSize:'60px', textAlign:'center', letterSpacing:'-3px', marginBottom:'40px'}}>COMMAND HUB</h1>
                    <div style={s.card(theme.hub)}>
                        <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                            <input style={{...s.input, flex:4, fontSize:'40px', textAlign:'center'}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                            <button style={{...s.btnG(theme.hub), flex:1, fontSize:'20px'}} onClick={runDVLA}>FIND</button>
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <input style={s.input} value={job.vehicle.make} onChange={e=>setJob({...job, vehicle:{...job.vehicle, make:e.target.value}})} placeholder="Make" />
                            <input style={s.input} value={job.vehicle.year} onChange={e=>setJob({...job, vehicle:{...job.vehicle, year:e.target.value}})} placeholder="Model/Year" />
                            <input style={s.input} value={job.vehicle.colour} onChange={e=>setJob({...job, vehicle:{...job.vehicle, colour:e.target.value}})} placeholder="Colour" />
                            <input style={s.input} value={job.vehicle.mileage} onChange={e=>setJob({...job, vehicle:{...job.vehicle, mileage:e.target.value}})} placeholder="Mileage" />
                        </div>
                    </div>
                    <div style={s.card(theme.deal)}>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <input style={s.input} value={job.client.name} onChange={e=>setJob({...job, client:{...job.client, name:e.target.value}})} placeholder="Client Name" />
                            <input style={s.input} value={job.client.phone} onChange={e=>setJob({...job, client:{...job.client, phone:e.target.value}})} placeholder="Phone" />
                            <input style={s.input} value={job.insurance.name} onChange={e=>setJob({...job, insurance:{...job.insurance, name:e.target.value}})} placeholder="Insurer" />
                            <input style={s.input} value={job.insurance.claim} onChange={e=>setJob({...job, insurance:{...job.insurance, claim:e.target.value}})} placeholder="Claim Ref" />
                        </div>
                    </div>
                    <button style={{...s.btnG(theme.deal), width:'100%', padding:'30px', fontSize:'24px'}} onClick={()=>setView('EST')}>OPEN ESTIMATOR</button>
                    <button style={{...s.btnG(theme.danger), width:'100%', marginTop:'20px'}} onClick={() => { if(window.confirm("Reset?")) setJob(INITIAL_JOB); }}>RESET JOB</button>
                </div>
            )}

            {/* VIEW: ESTIMATOR */}
            {view === 'EST' && (
                <div style={{maxWidth:'850px', margin:'0 auto'}}>
                    <button style={{...s.btnG('#333'), width:'100%', marginBottom:'20px'}} onClick={()=>setView('HUB')}>BACK TO HUB</button>
                    <div style={s.card(theme.work)}>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'15px'}}>
                            <input style={s.input} placeholder="MET Hrs" value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} />
                            <input style={s.input} placeholder="Panel Hrs" value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} />
                            <input style={s.input} placeholder="Paint Hrs" value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} />
                        </div>
                        <input style={s.input} placeholder="Paint Materials £" value={job.repair.paintMats} onChange={e=>setJob({...job, repair:{...job.repair, paintMats:e.target.value}})} />
                        {job.repair.items.map((it,i) => (
                            <div key={i} style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                                <input style={{...s.input, flex:3}} value={it.desc} onChange={e=>{const n=[...job.repair.items];n[i].desc=e.target.value;setJob({...job, repair:{...job.repair, items:n}})}} placeholder="Item" />
                                <input style={{...s.input, flex:1}} value={it.cost} onChange={e=>{const n=[...job.repair.items];n[i].cost=e.target.value;setJob({...job, repair:{...job.repair, items:n}})}} placeholder="£" />
                                <button style={{...s.btnG(theme.danger)}} onClick={()=>{const n=job.repair.items.filter((_,x)=>x!==i);setJob({...job, repair:{...job.repair, items:n}})}} >X</button>
                            </div>
                        ))}
                        <button style={{...s.btnG(theme.work), width:'100%', marginTop:'15px'}} onClick={()=>setJob({...job, repair:{...job.repair, items:[...job.repair.items, {desc:'',cost:''}]}})}>+ ADD ITEM</button>
                    </div>
                    <div style={s.card(theme.deal)}>
                        <h2 style={{textAlign:'right', fontSize:'40px'}}>£{totals.total.toFixed(2)}</h2>
                        <input style={s.input} placeholder="Client Excess £" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                        <input style={s.input} placeholder="Invoice Date" value={job.invoiceDate} onChange={e=>setJob({...job, invoiceDate:e.target.value})} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'20px'}}>
                            <button style={s.btnG('#fff')} style={{...s.btnG('#fff'), color:'#000'}} onClick={()=>openDocument('INVOICE', 'FULL')}>FULL INVOICE</button>
                            <button style={s.btnG(theme.danger)} onClick={()=>openDocument('INVOICE', 'EXCESS')}>EXCESS INV</button>
                            <button style={s.btnG(theme.deal)} onClick={()=>openDocument('INVOICE', 'INSURER')}>INSURER INV</button>
                            <button style={s.btnG(theme.work)} onClick={()=>openDocument('JOB CARD', 'FULL')}>JOB CARD</button>
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW: FINANCE VAULT (NEWLY REBUILT) */}
            {view === 'FIN' && (
                <div style={{maxWidth:'850px', margin:'0 auto'}}>
                    <button style={{...s.btnG('#333'), width:'100%', marginBottom:'20px'}} onClick={()=>setView('HUB')}>BACK TO HUB</button>
                    
                    <div style={s.card(theme.fin)}>
                        <h1 style={{color:theme.fin, textAlign:'center'}}>FINANCIAL LEDGER</h1>
                        
                        {/* P&L DASHBOARD */}
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'30px'}}>
                            <div style={{...s.displayBox, textAlign:'center'}}>
                                <span style={{color:'#4ade80', fontSize:'12px', fontWeight:'bold'}}>TOTAL INCOME</span>
                                <div style={{fontSize:'28px', fontWeight:'bold', color:'#4ade80'}}>£{financialStats.income.toFixed(2)}</div>
                            </div>
                            <div style={{...s.displayBox, textAlign:'center'}}>
                                <span style={{color:theme.danger, fontSize:'12px', fontWeight:'bold'}}>TOTAL EXPENSE</span>
                                <div style={{fontSize:'28px', fontWeight:'bold', color:theme.danger}}>£{financialStats.expense.toFixed(2)}</div>
                            </div>
                        </div>

                        {/* ADD EXPENSE FORM */}
                        <div style={{border:'2px dashed #333', padding:'20px', borderRadius:'20px', marginBottom:'30px'}}>
                            <span style={s.label}>LOG NEW EXPENSE / UPLOAD RECEIPT</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                                <input style={s.input} placeholder="Vendor (e.g. Screwfix)" value={exVendor} onChange={e=>setExVendor(e.target.value)} />
                                <input style={s.input} type="number" placeholder="Cost £" value={exCost} onChange={e=>setExCost(e.target.value)} />
                            </div>
                            <input style={s.input} placeholder="Description" value={exDesc} onChange={e=>setExDesc(e.target.value)} />
                            <input style={s.input} type="date" value={exDate} onChange={e=>setExDate(e.target.value)} />
                            <span style={s.label}>Attach Receipt Photo (Optional)</span>
                            <input type="file" onChange={handleExpenseUpload} style={{color:'#fff', marginBottom:'15px'}} />
                            <button style={{...s.btnG(theme.fin), width:'100%'}} onClick={saveExpense}>+ SAVE EXPENSE ENTRY</button>
                        </div>

                        {/* DATA EXPORT */}
                        <button style={{...s.btnG(theme.hub), width:'100%', marginBottom:'30px'}} onClick={generateLedgerCSV}>DOWNLOAD LEDGER CSV (INCOME & OUT)</button>

                        {/* EXPENSE LIST */}
                        <span style={s.label}>RECENT EXPENDITURE</span>
                        {expenses.map(ex => (
                            <div key={ex.id} style={{borderBottom:'1px solid #333', padding:'15px 0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <div>
                                    <div style={{fontWeight:'bold', fontSize:'18px'}}>{ex.vendor}</div>
                                    <div style={{color:'#888', fontSize:'14px'}}>{ex.date} | {ex.desc}</div>
                                    {ex.evidenceUrl && <a href={ex.evidenceUrl} target="_blank" style={{color:theme.fin, fontSize:'12px'}}>VIEW RECEIPT</a>}
                                </div>
                                <div style={{textAlign:'right'}}>
                                    <div style={{color:theme.danger, fontWeight:'bold', fontSize:'18px'}}>-£{safeFloat(ex.cost).toFixed(2)}</div>
                                    <button style={{background:'transparent', border:'none', color:'#666', marginTop:'5px'}} onClick={()=>deleteExpense(ex.id)}>DELETE</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* VIEW: SETTINGS */}
            {view === 'SET' && (
                <div style={{maxWidth:'850px', margin:'0 auto'}}>
                    <button style={{...s.btnG('#333'), width:'100%', marginBottom:'20px'}} onClick={()=>setView('HUB')}>BACK TO HUB</button>
                    <div style={s.card(theme.set)}>
                        <span style={s.label}>Company Details</span>
                        <input style={s.input} value={settings.coName} onChange={e=>setSettings({...settings, coName:e.target.value})} placeholder="Company Name" />
                        <input style={s.input} value={settings.bank} onChange={e=>setSettings({...settings, bank:e.target.value})} placeholder="Bank Details" />
                        <input style={s.input} value={settings.dvlaKey} onChange={e=>setSettings({...settings, dvlaKey:e.target.value})} placeholder="DVLA Key" />
                        
                        <span style={s.label}>Logos</span>
                        <button style={{...s.btnG('#222'), marginBottom:'10px'}} onClick={()=>document.getElementById('logoUp').click()}>Upload Logo</button>
                        <input id="logoUp" type="file" style={{display:'none'}} onChange={e=>handleBrandingUpload(e, 'logoUrl')} />
                        <button style={{...s.btnG('#222'), marginBottom:'10px'}} onClick={()=>document.getElementById('qrUp').click()}>Upload QR</button>
                        <input id="qrUp" type="file" style={{display:'none'}} onChange={e=>handleBrandingUpload(e, 'paypalQr')} />

                        <span style={s.label}>Rates</span>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px'}}>
                            <input style={s.input} value={settings.markup} onChange={e=>setSettings({...settings, markup:e.target.value})} placeholder="Markup %" />
                            <input style={s.input} value={settings.labourRate} onChange={e=>setSettings({...settings, labourRate:e.target.value})} placeholder="Labour £" />
                            <input style={s.input} value={settings.vatRate} onChange={e=>setSettings({...settings, vatRate:e.target.value})} placeholder="VAT %" />
                        </div>
                        <button style={{...s.btnG(theme.deal), width:'100%', marginTop:'20px'}} onClick={async()=>{await setDoc(doc(db,'settings','global'), settings); alert("Saved")}}>SAVE SETTINGS</button>
                    </div>
                </div>
            )}

            {/* VIEW: PREVIEW DOCUMENT */}
            {view === 'PREVIEW' && (
                <div style={{background:'#fff', color:'#000', minHeight:'100vh', padding:'40px'}}>
                    <div className="no-print" style={{position:'fixed', top:0, left:0, right:0, background:'#111', padding:'15px', display:'flex', gap:'10px'}}>
                        <button style={{...s.btnG('#fff'), color:'#000', flex:1}} onClick={()=>window.print()}>PRINT</button>
                        <button style={{...s.btnG(theme.hub), flex:1}} onClick={()=>alert("Select Save as PDF in Printer Options")}>PDF</button>
                        <button style={{...s.btnG('#333'), flex:1}} onClick={()=>setView('EST')}>CLOSE</button>
                    </div>
                    <div style={{marginTop:'60px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', borderBottom:`5px solid ${theme.hub}`, paddingBottom:'20px'}}>
                            <div>
                                {settings.logoUrl && <img src={settings.logoUrl} style={{height:'80px'}} alt="logo" />}
                                <h1 style={{margin:0, color:theme.hub}}>{settings.coName}</h1>
                                <p>{settings.address}</p>
                            </div>
                            <div style={{textAlign:'right'}}>
                                <h1>{printMode === 'EXCESS' ? 'INVOICE (EXCESS)' : docType}</h1>
                                <p><strong>Inv #:</strong> {job.invoiceNo}</p>
                                <p><strong>Reg:</strong> {job.vehicle.reg}</p>
                            </div>
                        </div>
                        
                        <table style={{width:'100%', marginTop:'30px', borderCollapse:'collapse'}}>
                            <thead><tr style={{background:'#eee'}}><th style={{textAlign:'left', padding:'10px'}}>Description</th><th style={{textAlign:'right', padding:'10px'}}>Cost</th></tr></thead>
                            <tbody>
                                {printMode !== 'EXCESS' && (
                                    <>
                                        {job.repair.items.map((it,i)=>(<tr key={i} style={{borderBottom:'1px solid #ddd'}}><td style={{padding:'10px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'10px'}}>£{(safeFloat(it.cost)*(1+safeFloat(settings.markup)/100)).toFixed(2)}</td></tr>))}
                                        <tr><td style={{padding:'10px'}}>Labour</td><td style={{textAlign:'right', padding:'10px'}}>£{totals.lPrice.toFixed(2)}</td></tr>
                                        <tr><td style={{padding:'10px'}}>Paint & Mats</td><td style={{textAlign:'right', padding:'10px'}}>£{safeFloat(job.repair.paintMats).toFixed(2)}</td></tr>
                                    </>
                                )}
                                {printMode === 'EXCESS' && <tr><td style={{padding:'10px'}}>Insurance Excess</td><td style={{textAlign:'right', padding:'10px'}}>£{safeFloat(job.repair.excess).toFixed(2)}</td></tr>}
                            </tbody>
                        </table>

                        <div style={{marginTop:'30px', textAlign:'right'}}>
                            <h1>Total: £{printMode === 'EXCESS' ? safeFloat(job.repair.excess).toFixed(2) : printMode === 'INSURER' ? totals.insurer.toFixed(2) : totals.total.toFixed(2)}</h1>
                        </div>
                    </div>
                </div>
            )}

            {/* DOCK */}
            <div className="no-print" style={s.dock}>
                <button onClick={()=>setView('HUB')} style={{...s.btnG(view==='HUB'?theme.hub:'#222'), minWidth:'80px'}}>HUB</button>
                <button onClick={()=>setView('EST')} style={{...s.btnG(view==='EST'?theme.hub:'#222'), minWidth:'80px'}}>EST</button>
                <button onClick={()=>setView('FIN')} style={{...s.btnG(view==='FIN'?theme.fin:'#222'), minWidth:'80px'}}>FIN</button>
                <button onClick={()=>setView('SET')} style={{...s.btnG(view==='SET'?'#666':'#222'), minWidth:'80px'}}>SET</button>
                <button onClick={async()=>{setLoading(true); await setDoc(doc(db,'estimates',job.vehicle.reg||'draft'), {...job, totals, createdAt: serverTimestamp()}); setLoading(false); alert("Saved")}} style={{...s.btnG(theme.deal), minWidth:'120px'}}>SAVE JOB</button>
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
