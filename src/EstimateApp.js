import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

const theme = { bg: '#000', card: '#111', est: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', text: '#f8fafc', border: '#333' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '12px', padding: '20px', marginBottom: '15px', border: `1px solid ${theme.border}`, borderTop: `4px solid ${color || theme.est}` }),
    input: { width: '100%', background: '#000', border: '1px solid #444', color: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '10px', outline: 'none' },
    label: { color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'block' },
    btnG: { background: theme.deal, color: 'white', border: 'none', padding: '15px 25px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' },
    btnR: { background: '#ef4444', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '15px', display: 'flex', gap: '10px', overflowX: 'auto', borderTop: '2px solid #333', zIndex: 1000, justifyContent: 'center' }
};

const EstimateApp = ({ userId }) => {
    const [page, setPage] = useState('HOME'); 
    const [loading, setLoading] = useState(false);
    const [calc, setCalc] = useState(false);
    
    const [settings, setSettings] = useState({ coName: 'Triple MMM Body Repairs', address: '20A New Street, ML9 3LT', phone: '07501 728319', bank: '80-22-60 | 06163462', markup: '20', labourRate: '50', vatRate: '20', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', password: '1234' });
    const [job, setJob] = useState({
        client: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', network: '', email: '', address: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', fuel: '', engine: '', mot: '', tax: '', colour: '' },
        repair: { items: [], panelHrs: 0, paintHrs: 0, metHrs: 0, paintMats: 0, excess: 0 },
        vault: { auth: '', sat: '', tc: '', photos: [] }
    });

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
    }, []);

    const totals = useMemo(() => {
        const partsCost = job.repair.items.reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const partsPrice = partsCost * (1 + (parseFloat(settings.markup) / 100));
        const labPrice = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0)) * settings.labourRate;
        const sub = partsPrice + labPrice + parseFloat(job.repair.paintMats || 0);
        const vat = sub * (parseFloat(settings.vatRate) / 100);
        const total = sub + vat;
        return { sub, vat, total, customer: parseFloat(job.repair.excess || 0), insurer: total - parseFloat(job.repair.excess || 0), profit: total - (partsCost + parseFloat(job.repair.paintMats || 0)) };
    }, [job.repair, settings]);

    const runDVLA = async () => {
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob({...job, vehicle: {...job.vehicle, make: d.make, year: d.yearOfManufacture, fuel: d.fuelType, engine: d.engineCapacity, mot: d.motStatus, tax: d.taxStatus, colour: d.colour}});
        } catch (e) { alert("DVLA Link Down - Manual Entry Required"); }
        setLoading(false);
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '140px' }}>
            {calc && <div style={{position:'fixed', top:'20%', right:'10%', background:'#111', padding:'20px', border:'2px solid orange', zIndex:2000, borderRadius:'10px'}}>
                <input id="v1" style={s.input} placeholder="Val 1" /> <input id="v2" style={s.input} placeholder="Val 2" />
                <button style={s.btnG} onClick={()=>alert(parseFloat(document.getElementById('v1').value) + parseFloat(document.getElementById('v2').value))}>+</button>
                <button onClick={()=>setCalc(false)} style={{...s.btnR, marginLeft:'10px'}}>X</button>
            </div>}

            {/* PAGE: HOME HUB */}
            {page === 'HOME' && (
                <div>
                    <h1 style={{color:theme.est}}>MANAGEMENT HUB</h1>
                    <div style={s.card(theme.est)}>
                        <span style={s.label}>Vehicle Specs (DVLA)</span>
                        <div style={{display:'flex', gap:'10px'}}>
                            <input style={{...s.input, fontSize:'20px', fontWeight:'bold'}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                            <button style={s.btnG} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                        </div>
                        <input style={s.input} placeholder="Manual VIN / Chassis" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                    </div>
                    <div style={s.card(theme.est)}>
                        <span style={s.label}>Client & Insurance Details</span>
                        <input style={s.input} placeholder="Insurance Company" value={job.insurance.co} />
                        <input style={s.input} placeholder="Claim Number" value={job.insurance.claim} />
                        <input style={s.input} placeholder="Network ID" value={job.insurance.network} />
                        <button style={{...s.btnG, width:'100%', marginTop:'10px'}} onClick={()=>setPage('ESTIMATE')}>IMPORT TO ESTIMATE (GREEN)</button>
                    </div>
                </div>
            )}

            {/* PAGE: ESTIMATE */}
            {page === 'ESTIMATE' && (
                <div>
                    <button onClick={()=>setPage('HOME')} style={{background:'none', color:theme.est, border:'none', cursor:'pointer', marginBottom:'10px'}}>← BACK TO HUB</button>
                    <h1 style={{color:theme.est}}>ESTIMATING ENGINE</h1>
                    <div style={s.card(theme.est)}>
                        <span style={s.label}>Add Repair Items</span>
                        <div style={{display:'flex', gap:'10px'}}>
                            <input id="pDes" style={{...s.input, flex:2}} placeholder="Part Name" />
                            <input id="pPri" style={{...s.input, flex:1}} placeholder="Price £" />
                            <button style={s.btnG} onClick={()=>{
                                const d=document.getElementById('pDes'), p=document.getElementById('pPri');
                                if(d.value && p.value) setJob({...job, repair:{...job.repair, items:[...job.repair.items, {desc:d.value, cost:p.value}]}});
                                d.value=''; p.value='';
                            }}>+</button>
                        </div>
                    </div>
                    <div style={s.card(theme.est)}>
                        <span style={s.label}>Paint & VAT Settings</span>
                        <input style={s.input} placeholder="Paint & Materials Cost £" value={job.repair.paintMats} onChange={e=>setJob({...job, repair:{...job.repair, paintMats:e.target.value}})} />
                        <div style={{display:'flex', gap:'10px'}}>
                            <input style={{...s.input, flex:1}} placeholder="VAT %" value={settings.vatRate} onChange={e=>setSettings({...settings, vatRate:e.target.value})} />
                            <input style={{...s.input, flex:1, color:theme.danger}} placeholder="Excess -£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                        </div>
                    </div>
                    <div style={{...s.card(theme.deal), background:theme.deal, borderTop:'none'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div><span style={{color:'white', fontSize:'10px'}}>GRAND TOTAL</span><h1 style={{margin:0}}>£{totals.total.toFixed(2)}</h1></div>
                            <button style={{background:'white', color:theme.deal, border:'none', padding:'10px 20px', borderRadius:'8px', fontWeight:'bold'}} onClick={()=>setPage('INVOICE')}>SAVE & VIEW INVOICE</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DOCK NAVIGATION BAR */}
            <div className="no-print" style={s.dock}>
                <button style={{...s.btnG, background:theme.est}} onClick={()=>setPage('HOME')}>HUB</button>
                <button style={{...s.btnG, background:theme.work}} onClick={()=>setPage('WORKSHOP')}>WORKSHOP</button>
                <button style={{...s.btnG, background:theme.deal}} onClick={()=>setPage('VAULT')}>VAULT</button>
                <button style={{...s.btnG, background:theme.set}} onClick={()=>setPage('SETTINGS')}>SET</button>
                <button style={s.btnG} onClick={()=>setCalc(true)}>🧮</button>
                <button style={{...s.btnG, background:theme.deal}} onClick={async () => {
                    await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
                    alert("Triple MMM Deal Folder Synced");
                }}>SAVE (GREEN)</button>
            </div>

            <style>{`
                @media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }
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
