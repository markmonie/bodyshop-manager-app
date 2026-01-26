import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyDVfPvFLoL5eqQ3WQB96n08K3thdclYXRQ",
  authDomain: "triple-mmm-body-repairs.firebaseapp.com",
  projectId: "triple-mmm-body-repairs",
  storageBucket: "triple-mmm-body-repairs.firebasestorage.app",
  messagingSenderId: "110018101133",
  appId: "1:110018101133:web:63b0996c7050c4967147c4",
  measurementId: "G-NRDPCR0SR2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- STABLE DVLA ENGINE ---
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

const theme = { bg: '#0f172a', card: '#1e293b', accent: '#f97316', text: '#f8fafc', textDim: '#94a3b8', success: '#16a34a', danger: '#ef4444', border: '#334155' };
const s = {
    card: { background: theme.card, borderRadius: '16px', padding: '20px', marginBottom: '20px', border: `1px solid ${theme.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' },
    input: { width: '100%', background: '#0f172a', border: `1px solid ${theme.border}`, color: theme.text, padding: '12px', borderRadius: '8px', marginBottom: '10px', outline: 'none' },
    label: { color: theme.accent, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'block' },
    btnGreen: { background: theme.success, color: 'white', border: 'none', padding: '14px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    secondaryBtn: { background: '#334155', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }
};

const EstimateApp = ({ userId }) => {
    const [page, setPage] = useState('WORKSHOP'); 
    const [loading, setLoading] = useState(false);
    const [currentJobId, setCurrentJobId] = useState(null);

    const [settings, setSettings] = useState({
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319',
        bank: '80-22-60 | 06163462', vatRate: '0', markup: '20', labourRate: '50', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc'
    });

    const [customer, setCustomer] = useState({ name: '', phone: '', address: '' });
    const [vehicle, setVehicle] = useState({ 
        reg: '', make: '', model: '', year: '', colour: '', fuel: '', engine: '', co2: '', mot: '', tax: '', vin: '', paint: '' 
    });
    const [repair, setRepair] = useState({ items: [], labourHours: '', paintMaterials: '', excess: '0' });
    const [savedJobs, setSavedJobs] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        return onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setSavedJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const totals = useMemo(() => {
        const pCost = (repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(settings.markup || 20) / 100));
        const labour = (parseFloat(repair.labourHours) || 0) * (parseFloat(settings.labourRate || 50) || 0);
        const paint = parseFloat(repair.paintMaterials) || 0;
        const sub = pPrice + labour + paint;
        const total = sub + (sub * (parseFloat(settings.vatRate || 0) / 100));
        const excess = parseFloat(repair.excess || 0);
        return { total, customerDue: excess, insuranceDue: total - excess, netProfit: total - (pCost + paint), labourPrice: labour, paintPrice: paint, pPrice };
    }, [repair, settings]);

    const lookupReg = async () => {
        if (!vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setVehicle(v => ({ 
                ...v, make: d.make, year: d.yearOfManufacture, colour: d.colour, fuel: d.fuelType, 
                engine: d.engineCapacity, co2: d.co2Emissions, mot: d.motStatus, tax: d.taxStatus 
            }));
        } catch (e) { alert("DVLA Connection Error."); }
        setLoading(false);
    };

    const addPart = () => {
        const n = document.getElementById('pN'), c = document.getElementById('pC');
        if (!n.value || !c.value) return;
        setRepair({...repair, items: [...repair.items, { desc: n.value, cost: c.value }]});
        n.value = ''; c.value = '';
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '120px' }}>
            <div className="no-print" style={{ display: 'flex', gap: '15px', borderBottom: `1px solid ${theme.border}`, marginBottom: '20px', paddingBottom: '10px' }}>
                <button onClick={() => setPage('WORKSHOP')} style={page === 'WORKSHOP' ? {color:theme.accent, background:'none', border:'none', fontWeight:'bold'} : {color:theme.textDim, background:'none', border:'none'}}>WORKSHOP</button>
                <button onClick={() => setPage('SETTINGS')} style={page === 'SETTINGS' ? {color:theme.accent, background:'none', border:'none', fontWeight:'bold'} : {color:theme.textDim, background:'none', border:'none'}}>SETTINGS</button>
            </div>

            {page === 'WORKSHOP' && (
                <>
                    <div style={s.card}>
                        <span style={s.label}>Vehicle Technical Data (DVLA)</span>
                        <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                            <input style={{...s.input, fontSize:'20px', fontWeight:'bold', flex:1, marginBottom:0}} value={vehicle.reg} onChange={e => setVehicle({...vehicle, reg: e.target.value.toUpperCase()})} placeholder="REG" />
                            <button onClick={lookupReg} style={{...s.btnGreen, width:'80px'}}>{loading ? '...' : 'FIND'}</button>
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <input style={s.input} placeholder="Make" value={vehicle.make} onChange={e => setVehicle({...vehicle, make: e.target.value})} />
                            <input style={s.input} placeholder="Colour" value={vehicle.colour} onChange={e => setVehicle({...vehicle, colour: e.target.value})} />
                            <input style={s.input} placeholder="Year" value={vehicle.year} onChange={e => setVehicle({...vehicle, year: e.target.value})} />
                            <input style={s.input} placeholder="Fuel" value={vehicle.fuel} onChange={e => setVehicle({...vehicle, fuel: e.target.value})} />
                            <input style={s.input} placeholder="Engine (cc)" value={vehicle.engine} onChange={e => setVehicle({...vehicle, engine: e.target.value})} />
                            <input style={s.input} placeholder="CO2" value={vehicle.co2} onChange={e => setVehicle({...vehicle, co2: e.target.value})} />
                            <input style={s.input} placeholder="MOT Status" value={vehicle.mot} onChange={e => setVehicle({...vehicle, mot: e.target.value})} />
                            <input style={s.input} placeholder="Tax Status" value={vehicle.tax} onChange={e => setVehicle({...vehicle, tax: e.target.value})} />
                        </div>
                        <input style={s.input} placeholder="Manual Chassis / VIN" value={vehicle.vin} onChange={e => setVehicle({...vehicle, vin: e.target.value})} />
                    </div>

                    <div style={s.card}>
                        <span style={s.label}>Parts Matrix (Cost Price)</span>
                        <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                            <input id="pN" placeholder="Part Description" style={{...s.input, flex:2, marginBottom:0}} />
                            <input id="pC" type="number" placeholder="Cost £" style={{...s.input, flex:1, marginBottom:0}} />
                            <button onClick={addPart} style={s.btnGreen}>+</button>
                        </div>
                        {repair.items.map((it, i) => (
                            <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #334155'}}>
                                <span>{it.desc}</span>
                                <strong>£{(parseFloat(it.cost)*(1+(settings.markup/100))).toFixed(2)}</strong>
                            </div>
                        ))}
                    </div>

                    <div style={{...s.card, background:theme.accent}}>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                            <div><span style={s.label}>Labour Hours</span><input type="number" style={{...s.input, background:'rgba(0,0,0,0.2)'}} value={repair.labourHours} onChange={e => setRepair({...repair, labourHours: e.target.value})} /></div>
                            <div><span style={s.label}>Customer Excess £</span><input type="number" style={{...s.input, background:'rgba(0,0,0,0.2)'}} value={repair.excess} onChange={e => setRepair({...repair, excess: e.target.value})} /></div>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', marginTop:'15px'}}>
                            <div><span style={{fontSize:'10px'}}>INSURANCE BALANCE</span><div style={{fontSize:'22px', fontWeight:'bold'}}>£{totals.insuranceDue.toFixed(2)}</div></div>
                            <div style={{textAlign:'right'}}><span style={{fontSize:'10px'}}>TOTAL DUE</span><div style={{fontSize:'22px', fontWeight:'bold'}}>£{totals.total.toFixed(2)}</div></div>
                        </div>
                    </div>
                </>
            )}

            <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card, padding: '15px', display: 'flex', gap: '10px', borderTop: `1px solid ${theme.border}`, zIndex: 1000 }}>
                <button onClick={async () => { await setDoc(doc(db, 'estimates', vehicle.reg || Date.now().toString()), { vehicle, repair, totals, createdAt: serverTimestamp() }); alert("Synced"); }} style={{ ...s.btnGreen, flex: 2 }}>SAVE JOB</button>
                <button onClick={() => window.print()} style={{...s.secondaryBtn, flex: 1}}>🖨️ PRINT</button>
            </div>

            <div className="print-only" style={{ display: 'none', color: 'black', fontFamily: 'Arial' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px solid #f97316', paddingBottom: '10px' }}>
                    <div><h1>{settings.coName}</h1><p>{settings.address}</p></div>
                    <div style={{textAlign:'right'}}><h2 style={{color:'#f97316'}}>INVOICE</h2><p>Date: {new Date().toLocaleDateString()}<br/>Reg: {vehicle.reg}</p></div>
                </div>
                <div style={{marginTop:'20px', background:'#eee', padding:'10px'}}>
                    <h3>VEHICLE SPECIFICATION</h3>
                    <p>Make: {vehicle.make} | Year: {vehicle.year} | Fuel: {vehicle.fuel} | CC: {vehicle.engine}</p>
                    <p>VIN: {vehicle.vin}</p>
                </div>
                <div style={{marginTop:'20px', textAlign:'right'}}>
                    <h2>GRAND TOTAL: £{totals.total.toFixed(2)}</h2>
                    <p>Insurance Liability: £{totals.insuranceDue.toFixed(2)}</p>
                    <p><strong>Customer Excess: £{totals.customerDue.toFixed(2)}</strong></p>
                </div>
            </div>
            <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }`}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
