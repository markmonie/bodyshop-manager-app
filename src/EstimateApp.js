import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, updatePassword } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- TRIPLE MMM ENTERPRISE CONFIG ---
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

// --- DVLA & EXTERNAL ENGINE ---
const axios = {
    post: async (url, data, config) => {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...config.headers },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`DVLA Error: ${response.status}`);
        return { data: await response.json() };
    }
};

// --- ENTERPRISE BRANDING & THEME (ORANGE / GREEN / BLACK) ---
const theme = {
    hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', fin: '#8b5cf6',
    bg: '#000000', card: '#111111', text: '#f8fafc', border: '#333', danger: '#ef4444'
};

const s = {
    card: (color) => ({ background: theme.card, borderRadius: '16px', padding: '25px', marginBottom: '20px', border: `1px solid ${theme.border}`, borderTop: `8px solid ${color || theme.hub}`, boxShadow: '0 15px 50px rgba(0,0,0,0.7)' }),
    input: { width: '100%', background: '#000', border: '1px solid #444', color: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '12px', outline: 'none', fontSize: '16px' },
    label: { color: '#94a3b8', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '6px', display: 'block', letterSpacing: '1px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '18px 30px', borderRadius: '14px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '20px', display: 'flex', gap: '15px', overflowX: 'auto', borderTop: '2px solid #333', zIndex: 1000, justifyContent: 'center' }
};

const EstimateApp = ({ userId }) => {
    // --- APP NAVIGATION ---
    const [view, setView] = useState('AUTH'); // AUTH, HUB, ESTIMATOR, WORKSHOP, VAULT, FINANCE, SETTINGS, RECENT
    const [loading, setLoading] = useState(false);
    const [calcOpen, setCalcOpen] = useState(false);

    // --- GLOBAL ENTERPRISE STATE ---
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: '80-22-60 | 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', password: '1234', terms: 'Payment due strictly on collection.' 
    });

    const [job, setJob] = useState({
        client: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', network: '', email: '', address: '', phone: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', fuel: '', engine: '', mot: '', tax: '', colour: '', paintCode: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0', techNotes: '', damageReport: '' },
        vault: { auth: '', sat: '', tc: '', photos: [], supplierInvoices: [] }
    });

    const [history, setHistory] = useState([]);
    const [expenditure, setExpenditure] = useState([]);

    // --- INITIALIZATION ---
    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const qJ = query(collection(db, 'estimates'), orderBy('createdAt', 'desc'));
        const qE = query(collection(db, 'expenditure'), orderBy('createdAt', 'desc'));
        const unsubJ = onSnapshot(qJ, snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsubE = onSnapshot(qE, snap => setExpenditure(snap.docs.map(d => ({id:d.id, ...d.data()}))));
        return () => { unsubJ(); unsubE(); };
    }, []);

    // --- INTELLIGENT CALCULATIONS ---
    const totals = useMemo(() => {
        const partsCost = (job.repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const partsPrice = partsCost * (1 + (parseFloat(settings.markup) / 100));
        const labHrs = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0));
        const labPrice = labHrs * parseFloat(settings.labourRate);
        const paintPrice = parseFloat(job.repair.paintMats || 0);
        const sub = partsPrice + labPrice + paintPrice;
        const vat = sub * (parseFloat(settings.vatRate) / 100);
        const total = sub + vat;
        const excess = parseFloat(job.repair.excess || 0);
        return { total, sub, vat, customer: excess, insurer: total - excess, profit: total - (partsCost + paintPrice), labHrs, labPrice, partsPrice };
    }, [job.repair, settings]);

    // --- CORE HUB FUNCTIONS ---
    const runDVLA = async () => {
        if (!job.vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob({...job, vehicle: {...job.vehicle, make: d.make, year: d.yearOfManufacture, fuel: d.fuelType, engine: d.engineCapacity, mot: d.motStatus, tax: d.taxStatus, colour: d.colour}});
        } catch (e) { alert("DVLA Handshake Failed. Manual Entry Required."); }
        setLoading(false);
    };

    const handleFileUpload = async (e, path, field) => {
        const file = e.target.files[0]; if (!file) return;
        const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if(path === 'branding') setSettings({...settings, logoUrl: url});
        else if(field === 'photos') setJob({...job, vault: {...job.vault, photos: [...job.vault.photos, url]}});
        else setJob({...job, vault: {...job.vault, [field]: url}});
    };

    const exportCSV = (type) => {
        let csv = type === 'INCOME' ? "Date,Reg,Client,Total,Insurer,Excess,Profit\n" : "Date,Supplier,Amount,JobRef\n";
        const data = type === 'INCOME' ? history : expenditure;
        data.forEach(item => {
            const date = item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
            if(type === 'INCOME') csv += `${date},${item.vehicle?.reg},${item.client?.name},${item.totals?.total},${item.totals?.insurer},${item.totals?.customer},${item.totals?.profit}\n`;
            else csv += `${date},${item.supplier},${item.amount},${item.reg}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `TripleMMM_${type}_Report.csv`; a.click();
    };

    // --- UI PAGES ---
    if (view === 'AUTH') return (
        <div style={{background:theme.bg, height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', padding:'40px'}}>
            <div style={{...s.card(theme.hub), width:'100%', maxWidth:'450px', textAlign:'center'}}>
                <h1 style={{color:theme.hub, fontSize:'32px', letterSpacing:'-2px'}}>TRIPLE MMM <span style={{color:'white'}}>SECURE</span></h1>
                <p style={{color:theme.textDim, fontSize:'14px', marginBottom:'25px'}}>Enterprise Management Portal</p>
                <input type="password" id="sys_pass" style={s.input} placeholder="Workshop Access Code" />
                <button style={{...s.btnG(theme.hub), width:'100%'}} onClick={() => document.getElementById('sys_pass').value === settings.password ? setView('HUB') : alert("Access Denied")}>AUTHORIZE</button>
            </div>
        </div>
    );

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '160px' }}>
            
            {/* HUB - CENTRAL INTELLIGENCE */}
            {view === 'HUB' && (
                <div className="no-print">
                    <h1 style={{color:theme.hub}}>MANAGEMENT HUB</h1>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>1. Technical Data Intake (DVLA)</span>
                        <div style={{display:'flex', gap:'12px', marginBottom:'15px'}}>
                            <input style={{...s.input, fontSize:'24px', fontWeight:'900', textAlign:'center', flex:2, marginBottom:0, border:`2px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                            <button style={{...s.btnG(theme.hub), width:'120px'}} onClick={runDVLA}>{loading ? '...' : 'PULL DATA'}</button>
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <input style={s.input} placeholder="Manufacturer" value={job.vehicle.make} onChange={e=>setJob({...job, vehicle:{...job.vehicle, make:e.target.value}})} />
                            <input style={s.input} placeholder="Year" value={job.vehicle.year} onChange={e=>setJob({...job, vehicle:{...job.vehicle, year:e.target.value}})} />
                        </div>
                        <input style={s.input} placeholder="Manual Chassis / VIN" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', fontSize:'12px'}}>
                            <div style={{background:'#222', padding:'12px', borderRadius:'10px'}}>Fuel: {job.vehicle.fuel}</div>
                            <div style={{background:'#222', padding:'12px', borderRadius:'10px'}}>MOT: {job.vehicle.mot}</div>
                            <div style={{background:'#222', padding:'12px', borderRadius:'10px'}}>Tax: {job.vehicle.tax}</div>
                        </div>
                    </div>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>2. Insurance & Client Stakeholders</span>
                        <input style={s.input} placeholder="Client Name" value={job.client.name} onChange={e=>setJob({...job, client:{...job.client, name:e.target.value}})} />
                        <input style={s.input} placeholder="Client Address" value={job.client.address} onChange={e=>setJob({...job, client:{...job.client, address:e.target.value}})} />
                        <hr style={{borderColor:theme.border, margin:'15px 0'}}/>
                        <input style={s.input} placeholder="Insurance Company" value={job.insurance.co} onChange={e=>setJob({...job, insurance:{...job.insurance, co:e.target.value}})} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <input style={s.input} placeholder="Claim Number" value={job.insurance.claim} onChange={e=>setJob({...job, insurance:{...job.insurance, claim:e.target.value}})} />
                            <input style={s.input} placeholder="Network Code" value={job.insurance.network} onChange={e=>setJob({...job, insurance:{...job.insurance, network:e.target.value}})} />
                        </div>
                        <button style={{...s.btnG(theme.deal), width:'100%', marginTop:'15px'}} onClick={()=>setView('ESTIMATOR')}>IMPORT TO ESTIMATOR (GREEN)</button>
                    </div>
                </div>
            )}

            {/* ESTIMATING ENGINE */}
            {view === 'ESTIMATOR' && (
                <div className="no-print">
                    <button onClick={()=>setView('HUB')} style={{background:'none', color:theme.hub, border:'none', marginBottom:'15px', fontWeight:'bold', cursor:'pointer'}}>← BACK TO HUB</button>
                    <h2 style={{color:theme.hub}}>ESTIMATING ENGINE</h2>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>Parts Matrix (Cost vs Markup)</span>
                        <div style={{display:'flex', gap:'12px', marginBottom:'15px'}}>
                            <input id="p_desc" style={{...s.input, flex:3, marginBottom:0}} placeholder="Part Description" />
                            <input id="p_cost" style={{...s.input, flex:1, marginBottom:0}} type="number" placeholder="Cost £" />
                            <button style={s.btnG(theme.deal)} onClick={()=>{
                                const d=document.getElementById('p_desc'), c=document.getElementById('p_cost');
                                if(d.value && c.value) setJob({...job, repair:{...job.repair, items:[...job.repair.items, {desc:d.value, cost:c.value}]}});
                                d.value=''; c.value='';
                            }}>+</button>
                        </div>
                        {job.repair.items.map((it, i) => (
                            <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid #333'}}>
                                <span>{it.desc}</span>
                                <strong>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</strong>
                            </div>
                        ))}
                    </div>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>Paint, Labour & Adjustments</span>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                            <input style={s.input} placeholder="Paint & Materials £" value={job.repair.paintMats} onChange={e=>setJob({...job, repair:{...job.repair, paintMats:e.target.value}})} />
                            <input style={{...s.input, color:theme.danger, fontWeight:'bold'}} placeholder="DEDUCT EXCESS -£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px'}}>
                            <div><span style={s.label}>MET Hrs</span><input style={s.input} value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} /></div>
                            <div><span style={s.label}>Panel Hrs</span><input style={s.input} value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} /></div>
                            <div><span style={s.label}>Paint Hrs</span><input style={s.input} value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} /></div>
                        </div>
                        <div style={{background:theme.bg, padding:'15px', borderRadius:'10px'}}>
                            <span style={s.label}>Current VAT Adjustment</span>
                            <div style={{display:'flex', gap:'10px'}}>
                                <input style={{...s.input, flex:1}} value={settings.vatRate} onChange={e=>setSettings({...settings, vatRate:e.target.value})} />
                                <button style={{...s.btnG(theme.hub), flex:2}}>Toggle VAT (Current: {settings.vatRate}%)</button>
                            </div>
                        </div>
                    </div>
                    <div style={{...s.card(theme.deal), background:theme.deal, border:'none'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div><span style={{color:'white', opacity:0.8, fontSize:'10px'}}>INSURER BALANCE</span><h1 style={{margin:0}}>£{totals.insurer.toFixed(2)}</h1></div>
                            <button style={{background:'white', color:theme.deal, border:'none', padding:'15px 25px', borderRadius:'12px', fontWeight:'900'}} onClick={() => window.print()}>PREVIEW SPLIT INVOICE</button>
                        </div>
                    </div>
                </div>
            )}

            {/* FINANCE VAULT */}
            {view === 'FINANCE' && (
                <div className="no-print">
                    <h1 style={{color:theme.fin}}>FINANCIAL CONTROL</h1>
                    <div style={s.card(theme.fin)}>
                        <span style={s.label}>Enterprise Revenue Log</span>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'20px'}}>
                            <div style={{background:'#000', padding:'20px', borderRadius:'15px'}}><span style={s.label}>Total Income</span><h2 style={{margin:0}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(2)}</h2></div>
                            <div style={{background:'#000', padding:'20px', borderRadius:'15px'}}><span style={s.label}>Gross Profit</span><h2 style={{margin:0, color:theme.deal}}>£{history.reduce((a,b)=>a+(b.totals?.profit||0),0).toFixed(2)}</h2></div>
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <button style={s.btnG(theme.fin)} onClick={()=>exportCSV('INCOME')}>EXPORT INCOME CSV</button>
                            <button style={s.btnG(theme.fin)} onClick={()=>exportCSV('EXPENSE')}>EXPORT EXPENSE CSV</button>
                        </div>
                    </div>
                    <div style={s.card(theme.fin)}>
                        <span style={s.label}>Log Expenditure (Receipt Vault)</span>
                        <input style={s.input} placeholder="Supplier Name" id="exp_sup" />
                        <input style={s.input} placeholder="Amount £" id="exp_amt" type="number" />
                        <input style={s.input} placeholder="Job Reg Ref" id="exp_reg" />
                        <button style={s.btnG(theme.deal)} onClick={async () => {
                            const s=document.getElementById('exp_sup').value, a=document.getElementById('exp_amt').value, r=document.getElementById('exp_reg').value;
                            await addDoc(collection(db, 'expenditure'), { supplier:s, amount:a, reg:r, createdAt: serverTimestamp() });
                            alert("Expense Vaulted");
                        }}>LOG EXPENSE (GREEN)</button>
                    </div>
                </div>
            )}

            {/* DOCK BAR (THE WORKSHOP NAVIGATOR) */}
            <div className="no-print" style={s.dock}>
                <button onClick={()=>setView('HUB')} style={{...s.btnG(view === 'HUB' ? theme.hub : '#222'), minWidth:'90px'}}>HUB</button>
                <button onClick={()=>setView('ESTIMATOR')} style={{...s.btnG(view === 'ESTIMATOR' ? theme.hub : '#222'), minWidth:'90px'}}>EST</button>
                <button onClick={()=>setView('WORKSHOP')} style={{...s.btnG(theme.work), minWidth:'90px'}}>WORK</button>
                <button onClick={()=>setView('VAULT')} style={{...s.btnG(theme.deal), minWidth:'90px'}}>DEAL</button>
                <button onClick={()=>setView('FINANCE')} style={{...s.btnG(theme.fin), minWidth:'90px'}}>FIN</button>
                <button onClick={()=>setView('SETTINGS')} style={{...s.btnG(theme.set), minWidth:'90px'}}>SET</button>
                <button onClick={async () => {
                    await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
                    alert("Triple MMM Master Record Synced");
                }} style={{...s.btnG(theme.deal), minWidth:'140px'}}>SAVE RECORD</button>
            </div>

            {/* PRINT VIEW (SPLIT INVOICE - COUNTINGUP STYLE) */}
            <div className="print-only" style={{display:'none', color:'black', padding:'50px', fontFamily:'Arial, sans-serif'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'5px solid #f97316', paddingBottom:'25px'}}>
                    <div>
                        {settings.logoUrl && <img src={settings.logoUrl} style={{height:'100px', marginBottom:'15px'}} alt="Logo" />}
                        <h1 style={{margin:0, fontSize:'36px'}}>{settings.coName}</h1>
                        <p style={{fontSize:'13px', marginTop:'8px'}}>{settings.address}<br/>Tel: {settings.phone}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                        <h2 style={{color:'#f97316', margin:0, fontSize:'42px'}}>INVOICE</h2>
                        <p style={{marginTop:'15px'}}><strong>Registration:</strong> {job.vehicle.reg}<br/><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                <div style={{marginTop:'45px', display:'flex', justifyContent:'space-between'}}>
                    <div style={{width:'48%', border:'1px solid #ddd', padding:'25px', borderRadius:'15px'}}>
                        <span style={{fontSize:'11px', fontWeight:'bold', color:'#888'}}>INVOICE TO</span>
                        <p style={{fontSize:'18px', margin:'12px 0 0 0'}}><strong>{job.client.name}</strong><br/>{job.client.address}</p>
                    </div>
                    <div style={{width:'48%', border:'1px solid #ddd', padding:'25px', borderRadius:'15px'}}>
                        <span style={{fontSize:'11px', fontWeight:'bold', color:'#888'}}>INSURANCE DATA</span>
                        <p style={{fontSize:'18px', margin:'12px 0 0 0'}}><strong>{job.insurance.co}</strong><br/>Claim No: {job.insurance.claim}<br/>Network ID: {job.insurance.network}</p>
                    </div>
                </div>
                <h3 style={{marginTop:'45px', background:'#f9f9f9', padding:'20px', borderLeft:'8px solid #f97316'}}>Vehicle: {job.vehicle.make} | Chassis: {job.vehicle.vin} | Colour: {job.vehicle.colour}</h3>
                <table style={{width:'100%', marginTop:'35px', borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f3f3f3', borderBottom:'3px solid #ddd'}}><th style={{padding:'18px', textAlign:'left'}}>Repair Item / Service Description</th><th style={{padding:'18px', textAlign:'right'}}>Total</th></tr></thead>
                    <tbody>
                        {job.repair.items.map((it, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'18px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'18px'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>
                        ))}
                        <tr style={{borderBottom:'1px solid #eee'}}><td style={{padding:'18px'}}>Professional Labour (MET/Panel/Paint) - {totals.labHrs} hrs</td><td style={{textAlign:'right', padding:'18px'}}>£{totals.labPrice.toFixed(2)}</td></tr>
                        <tr style={{borderBottom:'1px solid #eee'}}><td style={{padding:'18px'}}>Paint & Specialist Body Shop Consumables</td><td style={{textAlign:'right', padding:'18px'}}>£{parseFloat(job.repair.paintMats || 0).toFixed(2)}</td></tr>
                    </tbody>
                </table>
                <div style={{textAlign:'right', marginTop:'45px'}}>
                    <p style={{fontSize:'18px', margin:'8px 0'}}>Net Subtotal: £{totals.sub.toFixed(2)}</p>
                    <p style={{fontSize:'18px', margin:'8px 0'}}>VAT ({settings.vatRate}%): £{totals.vat.toFixed(2)}</p>
                    <h1 style={{color:'#f97316', marginTop:'15px', fontSize:'48px'}}>TOTAL: £{totals.total.toFixed(2)}</h1>
                    <div style={{background:'#fff3e0', padding:'30px', border:'3px solid #f97316', textAlign:'left', marginTop:'40px', borderRadius:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'12px'}}><span>CUSTOMER POLICY EXCESS (DUE FROM CLIENT):</span><strong style={{fontSize:'24px'}}>£{totals.customer.toFixed(2)}</strong></div>
                        <div style={{display:'flex', justifyContent:'space-between', color:'#f97316', borderTop:'3px solid #f97316', paddingTop:'15px'}}><span>BALANCE DUE FROM INSURER:</span><strong style={{fontSize:'36px'}}>£{totals.insurer.toFixed(2)}</strong></div>
                    </div>
                </div>
                <div style={{marginTop:'100px', borderTop:'1px solid #eee', paddingTop:'40px', display:'flex', justifyContent:'space-between', fontSize:'14px', color:'#555'}}>
                    <div><strong>Settlement Bank:</strong> {settings.bank}</div>
                    <div style={{textAlign:'right'}}><strong>T&Cs:</strong> {settings.terms}</div>
                </div>
            </div>

            <style>{`
                @media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }
                ::-webkit-scrollbar { height: 12px; } ::-webkit-scrollbar-thumb { background: #444; border-radius: 12px; }
            `}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
