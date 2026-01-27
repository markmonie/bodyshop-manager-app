import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc } from 'firebase/firestore';
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

// --- STABLE DVLA API HANDSHAKE ---
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

// --- ENTERPRISE DESIGN SYSTEM (ORANGE, GREEN, BLACK) ---
const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', bg: '#000', card: '#111', text: '#f8fafc', border: '#333', danger: '#ef4444' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '14px', padding: '25px', marginBottom: '20px', border: `1px solid ${theme.border}`, borderTop: `6px solid ${color || theme.hub}`, boxShadow: '0 10px 40px rgba(0,0,0,0.6)' }),
    input: { width: '100%', background: '#000', border: '1px solid #444', color: '#fff', padding: '14px', borderRadius: '10px', marginBottom: '12px', outline: 'none', fontSize: '15px' },
    label: { color: '#94a3b8', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '6px', display: 'block', letterSpacing: '0.8px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '16px 28px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.2s' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '18px', display: 'flex', gap: '15px', overflowX: 'auto', borderTop: '2px solid #333', zIndex: 1000, justifyContent: 'center' }
};

const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); // HUB, EST, WORK, DEAL, FIN, SET
    const [loading, setLoading] = useState(false);
    const [calcOpen, setCalcOpen] = useState(false);

    // --- CONSOLIDATED ENTERPRISE STATE ---
    const [settings, setSettings] = useState({ coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', bank: '80-22-60 | 06163462', markup: '20', labourRate: '50', vatRate: '20', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', password: '1234', terms: 'Payment due strictly on collection.' });
    const [job, setJob] = useState({
        client: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', network: '', email: '', address: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', fuel: '', engine: '', mot: '', tax: '', colour: '', paintCode: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0', techNotes: '' },
        vault: { auth: '', sat: '', tc: '', photos: [] }
    });
    const [history, setHistory] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        return onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const totals = useMemo(() => {
        const pCost = (job.repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(settings.markup) / 100));
        const labHrs = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0));
        const labPrice = labHrs * parseFloat(settings.labourRate);
        const paintPrice = parseFloat(job.repair.paintMats || 0);
        const sub = pPrice + labPrice + paintPrice;
        const vat = sub * (parseFloat(settings.vatRate) / 100);
        const total = sub + vat;
        const excess = parseFloat(job.repair.excess || 0);
        return { total, sub, vat, customer: excess, insurer: total - excess, profit: total - (pCost + paintPrice), labHrs, labPrice };
    }, [job.repair, settings]);

    const runDVLA = async () => {
        if (!job.vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob({...job, vehicle: {...job.vehicle, make: d.make, year: d.yearOfManufacture, fuel: d.fuelType, engine: d.engineCapacity, mot: d.motStatus, tax: d.taxStatus, colour: d.colour}});
        } catch (e) { alert("DVLA Link Down - Manual Data Entry Required."); }
        setLoading(false);
    };

    const handleUpload = async (e, field) => {
        const file = e.target.files[0]; if (!file) return;
        const r = ref(storage, `enterprise/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if(field === 'logo') setSettings({...settings, logoUrl: url});
        else setJob({...job, vault: {...job.vault, [field]: url}});
    };

    const downloadCSV = (type) => {
        let csv = type === 'INCOME' ? "Date,Reg,Client,Invoiced,Profit\n" : "Date,Item,Category,Amount\n";
        history.forEach(j => {
            const date = j.createdAt ? new Date(j.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
            if(type === 'INCOME') csv += `${date},${j.vehicle?.reg},${j.client?.name},${j.totals?.total},${j.totals?.profit}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `MMM_${type}_${new Date().getMonth()+1}.csv`; a.click();
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '160px' }}>
            {/* CALCULATOR INTERFACE */}
            {calcOpen && (
                <div style={{position:'fixed', top:'10%', right:'5%', background:theme.card, padding:'30px', border:`3px solid ${theme.hub}`, zIndex:2000, borderRadius:'20px', boxShadow:'0 30px 60px #000'}}>
                    <h3 style={{marginTop:0, color:theme.hub}}>Workshop Calculator</h3>
                    <input id="clA" style={s.input} placeholder="Value A" />
                    <input id="clB" style={s.input} placeholder="Value B" />
                    <button style={s.btnG(theme.hub)} onClick={()=>alert("Total: " + (parseFloat(document.getElementById('clA').value) + parseFloat(document.getElementById('clB').value)))}>SUM TOTAL</button>
                    <button onClick={()=>setCalcOpen(false)} style={{...s.btnG(theme.danger), width:'100%', marginTop:'10px'}}>CLOSE</button>
                </div>
            )}

            {/* MANAGEMENT HUB (THE BRAIN) */}
            {view === 'HUB' && (
                <div className="no-print">
                    <h1 style={{color:theme.hub, fontSize:'28px', letterSpacing:'-1px'}}>TRIPLE MMM <span style={{color:'white'}}>MANAGEMENT HUB</span></h1>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>1. Technical Vehicle Identification (DVLA)</span>
                        <div style={{display:'flex', gap:'12px', marginBottom:'15px'}}>
                            <input style={{...s.input, fontSize:'24px', fontWeight:'900', textAlign:'center', flex:2, marginBottom:0, border:`2px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="VEHICLE REG" />
                            <button style={{...s.btnG(theme.hub), width:'120px'}} onClick={runDVLA}>{loading ? '...' : 'PULL DATA'}</button>
                        </div>
                        <input style={s.input} placeholder="CHASSIS / VIN (MANUAL)" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', fontSize:'13px'}}>
                            <div style={{background:'#222', padding:'12px', borderRadius:'10px'}}><span style={s.label}>Make</span>{job.vehicle.make || '-'}</div>
                            <div style={{background:'#222', padding:'12px', borderRadius:'10px'}}><span style={s.label}>MOT Status</span>{job.vehicle.mot || '-'}</div>
                        </div>
                    </div>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>2. Stakeholder Profiles</span>
                        <input style={s.input} placeholder="Customer Name" value={job.client.name} onChange={e=>setJob({...job, client:{...job.client, name:e.target.value}})} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <input style={s.input} placeholder="Insurer" value={job.insurance.co} onChange={e=>setJob({...job, insurance:{...job.insurance, co:e.target.value}})} />
                            <input style={s.input} placeholder="Claim Ref" value={job.insurance.claim} onChange={e=>setJob({...job, insurance:{...job.insurance, claim:e.target.value}})} />
                        </div>
                        <button style={{...s.btnG(theme.deal), width:'100%', marginTop:'10px'}} onClick={()=>setView('EST')}>IMPORT TO ESTIMATOR (GREEN)</button>
                    </div>
                </div>
            )}

            {/* ESTIMATING ENGINE */}
            {view === 'EST' && (
                <div className="no-print">
                    <button onClick={()=>setView('HUB')} style={{background:'none', color:theme.hub, border:'none', marginBottom:'15px', fontWeight:'bold', cursor:'pointer'}}>← BACK TO HUB</button>
                    <h2 style={{color:theme.hub}}>ESTIMATING ENGINE</h2>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>Repair Items Matrix (Price + Markup)</span>
                        <div style={{display:'flex', gap:'12px', marginBottom:'15px'}}>
                            <input id="ptD" style={{...s.input, flex:3, marginBottom:0}} placeholder="Part Description" />
                            <input id="ptC" style={{...s.input, flex:1, marginBottom:0}} type="number" placeholder="Cost £" />
                            <button style={s.btnG(theme.deal)} onClick={()=>{
                                const d=document.getElementById('ptD'), c=document.getElementById('ptC');
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
                        <span style={s.label}>Paint, Labour & Adjustable VAT</span>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                            <input style={s.input} placeholder="Paint & Materials £" value={job.repair.paintMats} onChange={e=>setJob({...job, repair:{...job.repair, paintMats:e.target.value}})} />
                            <input style={{...s.input, color:theme.danger, fontWeight:'bold'}} placeholder="DEDUCT EXCESS -£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                        </div>
                    </div>
                    <div style={{...s.card(theme.deal), background:theme.deal, border:'none'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div><span style={{color:'white', opacity:0.8, fontSize:'10px'}}>INSURANCE BALANCE DUE</span><h1 style={{margin:0}}>£{totals.insurer.toFixed(2)}</h1></div>
                            <button style={{background:'white', color:theme.deal, border:'none', padding:'14px 24px', borderRadius:'10px', fontWeight:'900'}} onClick={() => window.print()}>PREVIEW SPLIT INVOICE</button>
                        </div>
                    </div>
                </div>
            )}

            {/* FINANCIAL VAULT */}
            {view === 'FIN' && (
                <div className="no-print">
                    <h2 style={{color:theme.finance}}>FINANCIAL VAULT (ACCOUNTING)</h2>
                    <div style={s.card(theme.finance)}>
                        <span style={s.label}>Enterprise Performance</span>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'20px'}}>
                            <div style={{background:'#000', padding:'20px', borderRadius:'12px'}}><span style={s.label}>Total Invoiced</span><h2 style={{margin:0}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(2)}</h2></div>
                            <div style={{background:'#000', padding:'20px', borderRadius:'12px'}}><span style={s.label}>Net Net Profit</span><h2 style={{margin:0, color:theme.deal}}>£{history.reduce((a,b)=>a+(b.totals?.profit||0),0).toFixed(2)}</h2></div>
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <button style={s.btnG(theme.finance)} onClick={()=>downloadCSV('INCOME')}>EXPORT INCOME CSV</button>
                            <button style={s.btnG(theme.finance)} onClick={()=>downloadCSV('EXPENSE')}>EXPORT EXPENSE CSV</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DOCK BAR NAVIGATION (INTERACTIVE) */}
            <div className="no-print" style={s.dock}>
                <button onClick={()=>setView('HUB')} style={{...s.btnG(view === 'HUB' ? theme.hub : '#222'), minWidth:'90px'}}>HUB</button>
                <button onClick={()=>setView('EST')} style={{...s.btnG(view === 'EST' ? theme.hub : '#222'), minWidth:'90px'}}>EST</button>
                <button onClick={()=>setView('WORK')} style={{...s.btnG(theme.work), minWidth:'90px'}}>WORK</button>
                <button onClick={()=>setView('DEAL')} style={{...s.btnG(theme.deal), minWidth:'90px'}}>DEAL</button>
                <button onClick={()=>setView('FIN')} style={{...s.btnG(theme.finance), minWidth:'90px'}}>FIN</button>
                <button onClick={()=>setView('SET')} style={{...s.btnG(theme.set), minWidth:'90px'}}>SET</button>
                <button onClick={()=>setCalcOpen(true)} style={{...s.btnG('#333'), minWidth:'50px'}}>🧮</button>
                <button style={{...s.btnG(theme.deal), minWidth:'130px'}} onClick={async () => {
                    await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
                    alert("Triple MMM Cloud Sync Successful");
                }}>SAVE (GREEN)</button>
            </div>

            {/* ENTERPRISE SPLIT INVOICE (PRINT ONLY) */}
            <div className="print-only" style={{display:'none', color:'black', padding:'40px', fontFamily:'Arial, sans-serif'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'4px solid #f97316', paddingBottom:'20px'}}>
                    <div>
                        {settings.logoUrl && <img src={settings.logoUrl} style={{height:'90px', marginBottom:'10px'}} alt="Logo" />}
                        <h1 style={{margin:0, color:'#f97316'}}>{settings.coName}</h1>
                        <p style={{fontSize:'12px', marginTop:'5px'}}>{settings.address}<br/>Tel: {settings.phone}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                        <h2 style={{color:'#f97316', margin:0, fontSize:'32px'}}>INVOICE</h2>
                        <p style={{marginTop:'10px'}}><strong>Registration:</strong> {job.vehicle.reg}<br/><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                <div style={{marginTop:'40px', display:'flex', justifyContent:'space-between'}}>
                    <div style={{width:'48%', border:'1px solid #ddd', padding:'20px', borderRadius:'12px'}}>
                        <span style={{fontSize:'11px', fontWeight:'bold', color:'#888'}}>CLIENT INVOICED</span>
                        <p style={{fontSize:'16px', margin:'10px 0 0 0'}}><strong>{job.client.name}</strong><br/>{job.client.address}</p>
                    </div>
                    <div style={{width:'48%', border:'1px solid #ddd', padding:'20px', borderRadius:'12px'}}>
                        <span style={{fontSize:'11px', fontWeight:'bold', color:'#888'}}>INSURANCE CLAIM DATA</span>
                        <p style={{fontSize:'16px', margin:'10px 0 0 0'}}><strong>{job.insurance.co}</strong><br/>Claim Number: {job.insurance.claim}<br/>Network ID: {job.insurance.network}</p>
                    </div>
                </div>
                <h3 style={{marginTop:'40px', background:'#f9f9f9', padding:'15px', borderLeft:'6px solid #f97316'}}>Vehicle: {job.vehicle.make} | Chassis: {job.vehicle.vin}</h3>
                <table style={{width:'100%', marginTop:'30px', borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f3f3f3', borderBottom:'2px solid #ddd'}}><th style={{padding:'15px', textAlign:'left'}}>Description of Repair</th><th style={{padding:'15px', textAlign:'right'}}>Amount</th></tr></thead>
                    <tbody>
                        {job.repair.items.map((it, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'15px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'15px'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>
                        ))}
                        <tr style={{borderBottom:'1px solid #eee'}}><td style={{padding:'15px'}}>Qualified Labour Hours ({totals.labHrs} hrs)</td><td style={{textAlign:'right', padding:'15px'}}>£{totals.labPrice.toFixed(2)}</td></tr>
                        <tr style={{borderBottom:'1px solid #eee'}}><td style={{padding:'15px'}}>Paint & Specialist Body Shop Materials</td><td style={{textAlign:'right', padding:'15px'}}>£{parseFloat(job.repair.paintMats || 0).toFixed(2)}</td></tr>
                    </tbody>
                </table>
                <div style={{textAlign:'right', marginTop:'40px'}}>
                    <p style={{fontSize:'16px', margin:'5px 0'}}>Net Subtotal: £{totals.sub.toFixed(2)}</p>
                    <p style={{fontSize:'16px', margin:'5px 0'}}>VAT ({settings.vatRate}%): £{totals.vat.toFixed(2)}</p>
                    <h1 style={{color:'#f97316', marginTop:'10px', fontSize:'36px'}}>TOTAL: £{totals.total.toFixed(2)}</h1>
                    <div style={{background:'#fff3e0', padding:'25px', border:'2px solid #f97316', textAlign:'left', marginTop:'30px', borderRadius:'15px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}><span>CUSTOMER POLICY EXCESS (DUE FROM CLIENT):</span><strong style={{fontSize:'20px'}}>£{totals.customer.toFixed(2)}</strong></div>
                        <div style={{display:'flex', justifyContent:'space-between', color:'#f97316', borderTop:'2px solid #f97316', paddingTop:'10px'}}><span>BALANCE DUE FROM INSURER:</span><strong style={{fontSize:'28px'}}>£{totals.insurer.toFixed(2)}</strong></div>
                    </div>
                </div>
                <div style={{marginTop:'80px', borderTop:'1px solid #eee', paddingTop:'30px', display:'flex', justifyContent:'space-between', fontSize:'13px', color:'#555'}}>
                    <div><strong>Settlement Bank:</strong> {settings.bank}</div>
                    <div style={{textAlign:'right'}}><strong>T&Cs:</strong> {settings.terms}</div>
                </div>
            </div>

            <style>{`
                @media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }
                ::-webkit-scrollbar { height: 10px; } ::-webkit-scrollbar-thumb { background: #444; border-radius: 10px; }
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
